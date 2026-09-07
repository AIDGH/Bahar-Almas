import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';

@Injectable()
export class LeaderboardService {
  constructor(private readonly prisma: PrismaService) {}

  async getTopPlayers(limit: number) {
    const players = await this.prisma.user.findMany({
      where: { bestScore: { gt: 0 } },
      orderBy: [{ bestScore: 'desc' }, { bestScoredAt: 'asc' }],
      take: limit,
      select: { id: true, displayName: true, bestScore: true },
    });
    return {
      data: players.map((player, index) => ({
        rank: index + 1,
        userId: player.id,
        displayName: player.displayName,
        score: player.bestScore,
      })),
    };
  }
}
