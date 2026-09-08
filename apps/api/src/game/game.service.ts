import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import {
  createHash,
  randomBytes,
  randomInt,
  timingSafeEqual,
} from 'node:crypto';
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
const CLAIM_WINDOW_MS = 24 * 60 * 60_000;

@Injectable()
export class GameService {
  constructor(private readonly prisma: PrismaService) {}

  async start() {
    const now = new Date();
    const seed = randomInt(1, 2_147_483_647);
    const claimToken = randomBytes(32).toString('base64url');
    const expiresAt = new Date(now.getTime() + GAME_DURATION_MS);
    const gameSession = await this.prisma.gameSession.create({
      data: {
        seed,
        claimTokenHash: hashToken(claimToken),
        claimExpiresAt: new Date(now.getTime() + CLAIM_WINDOW_MS),
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
        claimToken,
        targets: generateSchedule(seed),
      },
    };
  }

  async finish(sessionId: string, claimToken: string, dto: FinishGameDto) {
    const session = await this.prisma.gameSession.findUnique({
      where: { id: sessionId },
      include: { _count: { select: { hits: true } } },
    });
    if (!session) throw new NotFoundException('بازی پیدا نشد');
    this.assertClaimToken(session.claimTokenHash, claimToken);
    if (session.status === GameSessionStatus.COMPLETED) {
      return {
        data: {
          score: session.score,
          validHitCount: session._count.hits,
          rejectedHitCount: 0,
          claimed: Boolean(session.userId),
        },
      };
    }
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
    });
    return {
      data: {
        score,
        validHitCount: scoredHits.length,
        rejectedHitCount: dto.hits.length - validHits.length,
        claimed: false,
      },
    };
  }

  async claim(userId: string, sessionId: string, claimToken: string) {
    const session = await this.prisma.gameSession.findUnique({
      where: { id: sessionId },
    });
    if (!session) throw new NotFoundException('بازی پیدا نشد');
    this.assertClaimToken(session.claimTokenHash, claimToken);
    if (session.status !== GameSessionStatus.COMPLETED) {
      throw new BadRequestException('نتیجه این بازی هنوز آماده ثبت نیست');
    }
    if (
      session.claimExpiresAt &&
      session.claimExpiresAt.getTime() < Date.now()
    ) {
      throw new BadRequestException('مهلت ثبت رکورد این بازی گذشته است');
    }
    if (session.userId && session.userId !== userId) {
      throw new BadRequestException(
        'این رکورد قبلاً برای کاربر دیگری ثبت شده است',
      );
    }

    const result = await this.prisma.$transaction(async (transaction) => {
      const user = await transaction.user.findUniqueOrThrow({
        where: { id: userId },
        select: { bestScore: true },
      });
      const isPersonalBest = session.score > user.bestScore;

      if (!session.userId) {
        const claimed = await transaction.gameSession.updateMany({
          where: { id: session.id, userId: null },
          data: { userId },
        });
        if (claimed.count !== 1) {
          throw new BadRequestException('این رکورد هم‌زمان ثبت شده است');
        }
        await transaction.user.update({
          where: { id: userId },
          data: {
            totalGameScore: { increment: session.score },
            ...(isPersonalBest
              ? { bestScore: session.score, bestScoredAt: new Date() }
              : {}),
          },
        });
      }

      return {
        isPersonalBest: !session.userId && isPersonalBest,
        bestScore: Math.max(session.score, user.bestScore),
      };
    });

    const rank =
      (await this.prisma.user.count({
        where: { bestScore: { gt: result.bestScore } },
      })) + 1;
    return {
      data: {
        score: session.score,
        isPersonalBest: result.isPersonalBest,
        bestScore: result.bestScore,
        rank,
        claimed: true,
      },
    };
  }

  private assertClaimToken(
    expectedHash: string | null,
    suppliedToken: string,
  ): void {
    if (!expectedHash || !suppliedToken) {
      throw new UnauthorizedException('دسترسی به این بازی معتبر نیست');
    }
    const expected = Buffer.from(expectedHash, 'hex');
    const supplied = Buffer.from(hashToken(suppliedToken), 'hex');
    if (
      expected.length !== supplied.length ||
      !timingSafeEqual(expected, supplied)
    ) {
      throw new UnauthorizedException('دسترسی به این بازی معتبر نیست');
    }
  }
}

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
