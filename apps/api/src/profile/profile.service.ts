import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { GameSessionStatus } from '../generated/prisma/enums';

@Injectable()
export class ProfileService {
  constructor(private readonly prisma: PrismaService) {}

  async getProfile(userId: string, limit: number, offset: number) {
    const [user, games, totalGames] = await this.prisma.$transaction([
      this.prisma.user.findUniqueOrThrow({
        where: { id: userId },
        select: {
          id: true,
          mobile: true,
          displayName: true,
          referralCode: true,
          bestScore: true,
          totalGameScore: true,
          referralPoints: true,
        },
      }),
      this.prisma.gameSession.findMany({
        where: { userId, status: GameSessionStatus.COMPLETED },
        orderBy: [{ finishedAt: 'desc' }, { id: 'desc' }],
        skip: offset,
        take: limit,
        select: { id: true, score: true, finishedAt: true },
      }),
      this.prisma.gameSession.count({
        where: { userId, status: GameSessionStatus.COMPLETED },
      }),
    ]);

    return {
      data: {
        ...user,
        totalScore: user.totalGameScore + user.referralPoints,
        games: games.map((game) => ({
          id: game.id,
          score: game.score,
          playedAt: game.finishedAt?.toISOString(),
        })),
        totalGames,
        nextOffset:
          offset + games.length < totalGames ? offset + games.length : null,
      },
    };
  }

  async updateDisplayName(userId: string, displayNameValue: string) {
    const displayName = displayNameValue.trim().replace(/\s+/g, ' ');
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: { displayName },
      select: {
        id: true,
        mobile: true,
        displayName: true,
        referralCode: true,
        bestScore: true,
        totalGameScore: true,
        referralPoints: true,
      },
    });
    return {
      data: {
        ...user,
        totalScore: user.totalGameScore + user.referralPoints,
      },
    };
  }
}
