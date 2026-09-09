import { PrismaService } from '../database/prisma.service';
import { UserRole } from '../generated/prisma/enums';
import { AdminService } from './admin.service';
import { AdminUserGroup } from './admin.types';

describe('AdminService user groups', () => {
  it.each([
    [AdminUserGroup.USERS, { role: UserRole.USER, isBanned: false }],
    [AdminUserGroup.ADMINS, { role: UserRole.ADMIN, isBanned: false }],
    [AdminUserGroup.BANNED, { isBanned: true }],
  ])('filters the %s section on the server', async (group, expectedWhere) => {
    const findMany = jest.fn().mockResolvedValue([]);
    const count = jest.fn().mockResolvedValue(0);
    const prisma = {
      user: { findMany, count },
      $transaction: jest.fn().mockResolvedValue([[], 0]),
    } as unknown as PrismaService;
    const service = new AdminService(prisma);

    await service.getUsers(25, 0, '', group);

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expectedWhere }),
    );
    expect(count).toHaveBeenCalledWith({ where: expectedWhere });
  });
});
