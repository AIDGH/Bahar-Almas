import { createHash } from 'node:crypto';
import { PrismaService } from '../database/prisma.service';
import { GameSessionStatus } from '../generated/prisma/enums';
import { GameService } from './game.service';

describe('GameService referral reward', () => {
  it('awards the referrer only when the referred player claims the first scoring game', async () => {
    const claimToken = 'claim-token';
    const transaction = {
      user: {
        findUniqueOrThrow: jest.fn().mockResolvedValue({
          bestScore: 80,
          referredById: 'referrer-id',
        }),
        findFirst: jest.fn().mockResolvedValue({ id: 'referrer-id' }),
        update: jest.fn().mockResolvedValue({}),
      },
      gameSession: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      referralReward: {
        createMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    };
    const runTransaction = jest.fn(
      async (
        callback: (client: typeof transaction) => Promise<unknown>,
      ): Promise<unknown> => callback(transaction),
    );
    const prisma = {
      gameSession: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'game-id',
          claimTokenHash: createHash('sha256').update(claimToken).digest('hex'),
          claimExpiresAt: new Date(Date.now() + 60_000),
          status: GameSessionStatus.COMPLETED,
          userId: null,
          score: 120,
        }),
      },
      user: { count: jest.fn().mockResolvedValue(0) },
      $transaction: runTransaction,
    } as unknown as PrismaService;
    const service = new GameService(prisma);

    await expect(
      service.claim('referred-user-id', 'game-id', claimToken),
    ).resolves.toMatchObject({
      data: { score: 120, claimed: true, rank: 1 },
    });
    expect(transaction.referralReward.createMany).toHaveBeenCalledWith({
      data: [
        {
          referrerId: 'referrer-id',
          referredUserId: 'referred-user-id',
          points: 1_000,
        },
      ],
      skipDuplicates: true,
    });
    expect(transaction.user.update).toHaveBeenCalledWith({
      where: { id: 'referrer-id' },
      data: { referralPoints: { increment: 1_000 } },
    });
  });
});
