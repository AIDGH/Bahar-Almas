import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomInt } from 'node:crypto';
import { PrismaService } from '../database/prisma.service';
import { GameSessionStatus } from '../generated/prisma/enums';
import { FinishGameDto } from './dto/finish-game.dto';
import {
  GAME_DURATION_MS,
  VALIDATION_VERSION,
  applyComboMultipliers,
  generateSchedule,
  validateHits,
} from './game-schedule';

const FINISH_EARLY_TOLERANCE_MS = 2_000;
const FINISH_GRACE_MS = 90_000;
const MAX_STARTS_PER_TEN_MINUTES = 5;

@Injectable()
export class GameService {
  constructor(private readonly prisma: PrismaService) {}

  async start(userId: string) {
    const now = new Date();
    const recentStarts = await this.prisma.gameSession.count({
      where: {
        userId,
        createdAt: { gte: new Date(now.getTime() - 10 * 60_000) },
      },
    });
    if (recentStarts >= MAX_STARTS_PER_TEN_MINUTES) {
      throw new HttpException(
        'برای شروع بازی بعدی چند دقیقه صبر کنید',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    await this.prisma.gameSession.updateMany({
      where: { userId, status: GameSessionStatus.ACTIVE },
      data: { status: GameSessionStatus.INVALIDATED, finishedAt: now },
    });

    const seed = randomInt(1, 2_147_483_647);
    const expiresAt = new Date(now.getTime() + GAME_DURATION_MS);
    const gameSession = await this.prisma.gameSession.create({
      data: {
        userId,
        seed,
        startedAt: now,
        expiresAt,
        validationVersion: VALIDATION_VERSION,
      },
    });

    return {
      data: {
        id: gameSession.id,
        startedAt: gameSession.startedAt.toISOString(),
        durationMs: GAME_DURATION_MS,
        targets: generateSchedule(seed),
      },
    };
  }

  async finish(userId: string, sessionId: string, dto: FinishGameDto) {
    const session = await this.prisma.gameSession.findFirst({
      where: { id: sessionId, userId },
    });
    if (!session) throw new NotFoundException('بازی پیدا نشد');
    if (session.status !== GameSessionStatus.ACTIVE) {
      throw new BadRequestException('این بازی قبلاً بسته شده است');
    }

    const now = new Date();
    if (
      !dto.endedEarly &&
      now.getTime() < session.expiresAt.getTime() - FINISH_EARLY_TOLERANCE_MS
    ) {
      throw new BadRequestException('بازی هنوز تمام نشده است');
    }
    if (now.getTime() > session.expiresAt.getTime() + FINISH_GRACE_MS) {
      await this.prisma.gameSession.update({
        where: { id: session.id },
        data: { status: GameSessionStatus.EXPIRED, finishedAt: now },
      });
      throw new BadRequestException('مهلت ثبت امتیاز این بازی گذشته است');
    }

    const schedule = generateSchedule(session.seed, session.validationVersion);
    const sessionDurationMs =
      session.expiresAt.getTime() - session.startedAt.getTime();
    const serverElapsedMs = Math.max(
      0,
      Math.min(sessionDurationMs, now.getTime() - session.startedAt.getTime()),
    );
    const submittedHits = dto.endedEarly
      ? dto.hits.filter((hit) => hit.hitAtMs <= serverElapsedMs + 500)
      : dto.hits;
    const validHits = validateHits(schedule, submittedHits);
    const scoredHits = applyComboMultipliers(validHits);
    const score = scoredHits.reduce((sum, hit) => sum + hit.points, 0);
    const currentUser = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { bestScore: true },
    });
    const isPersonalBest = score > currentUser.bestScore;

    await this.prisma.$transaction(async (transaction) => {
      if (scoredHits.length > 0) {
        await transaction.gameHit.createMany({
          data: scoredHits.map((hit) => ({
            gameSessionId: session.id,
            targetId: hit.targetId,
            hitAtMs: hit.hitAtMs,
            swipeDistance: hit.swipeDistance,
            swipeDurationMs: hit.swipeDurationMs,
            points: hit.points,
          })),
          skipDuplicates: true,
        });
      }
      await transaction.gameSession.update({
        where: { id: session.id },
        data: {
          score,
          status: GameSessionStatus.COMPLETED,
          finishedAt: now,
        },
      });
      if (isPersonalBest) {
        await transaction.user.update({
          where: { id: userId },
          data: { bestScore: score, bestScoredAt: now },
        });
      }
    });

    const rank =
      (await this.prisma.user.count({ where: { bestScore: { gt: score } } })) +
      1;
    return {
      data: {
        score,
        validHitCount: scoredHits.length,
        rejectedHitCount: dto.hits.length - validHits.length,
        isPersonalBest,
        bestScore: Math.max(score, currentUser.bestScore),
        rank,
      },
    };
  }
}
