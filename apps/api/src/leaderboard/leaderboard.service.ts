import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';

@Injectable()
export class LeaderboardService {
  constructor(private readonly prisma: PrismaService) {}

  async getPlayers(limit: number, offset: number, currentUserId?: string) {
    const [players, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        where: { bestScore: { gt: 0 } },
        orderBy: [
          { bestScore: 'desc' },
          { bestScoredAt: 'asc' },
          { id: 'asc' },
        ],
        skip: offset,
        take: limit,
        select: { id: true, displayName: true, bestScore: true },
      }),
      this.prisma.user.count({ where: { bestScore: { gt: 0 } } }),
    ]);
    const currentUser = currentUserId
      ? await this.prisma.user.findUnique({
          where: { id: currentUserId },
          select: {
            id: true,
            displayName: true,
            bestScore: true,
            bestScoredAt: true,
          },
        })
      : null;

    let currentPlayer: {
      rank: number;
      userId: string;
      displayName: string;
      score: number;
    } | null = null;
    if (currentUser && currentUser.bestScore > 0) {
      const ahead = await this.prisma.user.count({
        where: {
          bestScore: { gt: 0 },
          OR: [
            { bestScore: { gt: currentUser.bestScore } },
            {
              bestScore: currentUser.bestScore,
              bestScoredAt: { lt: currentUser.bestScoredAt! },
            },
            {
              bestScore: currentUser.bestScore,
              bestScoredAt: currentUser.bestScoredAt,
              id: { lt: currentUser.id },
            },
          ],
        },
      });
      currentPlayer = {
        rank: ahead + 1,
        userId: currentUser.id,
        displayName: currentUser.displayName,
        score: currentUser.bestScore,
      };
    }

    return {
      data: {
        entries: players.map((player, index) => ({
          rank: offset + index + 1,
          userId: player.id,
          displayName: player.displayName,
          score: player.bestScore,
        })),
        total,
        nextOffset:
          offset + players.length < total ? offset + players.length : null,
        currentPlayer,
      },
    };
  }
}
