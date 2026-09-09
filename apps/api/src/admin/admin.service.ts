import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  normalizeDigits,
  normalizeIranianMobile,
} from '../auth/auth-normalization';
import { Prisma } from '../generated/prisma/client';
import { UserRole } from '../generated/prisma/enums';
import { PrismaService } from '../database/prisma.service';
import { AdminUserGroup } from './admin.types';
import { UpdateAdminUserDto } from './dto/update-admin-user.dto';

@Injectable()
export class AdminService {
  constructor(private readonly prisma: PrismaService) {}

  async getUsers(
    limit: number,
    offset: number,
    searchValue = '',
    group = AdminUserGroup.USERS,
  ) {
    const search = searchValue.trim();
    const digits = normalizeDigits(search).replace(/\D/g, '');
    const mobileSearch = digits.startsWith('0098')
      ? `0${digits.slice(4)}`
      : digits.startsWith('98')
        ? `0${digits.slice(2)}`
        : digits;
    const groupWhere: Prisma.UserWhereInput =
      group === AdminUserGroup.ADMINS
        ? { role: UserRole.ADMIN, isBanned: false }
        : group === AdminUserGroup.BANNED
          ? { isBanned: true }
          : { role: UserRole.USER, isBanned: false };
    const where: Prisma.UserWhereInput = {
      ...groupWhere,
      ...(search
        ? {
            OR: [
              { displayName: { contains: search, mode: 'insensitive' } },
              ...(mobileSearch ? [{ mobile: { contains: mobileSearch } }] : []),
              {
                referralCode: {
                  contains: search.toUpperCase(),
                  mode: 'insensitive',
                },
              },
            ],
          }
        : {}),
    };

    const [users, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        where,
        orderBy: [
          { bestScore: 'desc' },
          { bestScoredAt: 'asc' },
          { createdAt: 'asc' },
          { id: 'asc' },
        ],
        skip: offset,
        take: limit,
        select: {
          id: true,
          mobile: true,
          displayName: true,
          referralCode: true,
          role: true,
          isBanned: true,
          bannedAt: true,
          bestScore: true,
          totalGameScore: true,
          referralPoints: true,
          createdAt: true,
          _count: { select: { gameSessions: true, referrals: true } },
        },
      }),
      this.prisma.user.count({ where }),
    ]);

    return {
      data: {
        users: users.map(({ _count, ...user }) => ({
          ...user,
          bannedAt: user.bannedAt?.toISOString() ?? null,
          createdAt: user.createdAt.toISOString(),
          totalScore: user.totalGameScore + user.referralPoints,
          totalGames: _count.gameSessions,
          referralCount: _count.referrals,
        })),
        total,
        nextOffset:
          offset + users.length < total ? offset + users.length : null,
      },
    };
  }

  async updateUser(userId: string, dto: UpdateAdminUserDto) {
    const target = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, role: true },
    });
    if (!target) throw new NotFoundException('کاربر پیدا نشد');
    if (target.role === UserRole.ADMIN && dto.isBanned === true) {
      throw new BadRequestException('حساب ادمین قابل مسدودکردن نیست');
    }
    if (
      dto.displayName === undefined &&
      dto.mobile === undefined &&
      dto.isBanned === undefined
    ) {
      throw new BadRequestException('تغییری برای ذخیره ارسال نشده است');
    }

    const displayName = dto.displayName?.trim().replace(/\s+/g, ' ');
    const mobile = dto.mobile ? normalizeIranianMobile(dto.mobile) : undefined;
    if (mobile) {
      const duplicate = await this.prisma.user.findFirst({
        where: { mobile, id: { not: userId } },
        select: { id: true },
      });
      if (duplicate) {
        throw new ConflictException('این شماره برای کاربر دیگری ثبت شده است');
      }
    }

    const user = await this.prisma.$transaction(async (transaction) => {
      const updated = await transaction.user.update({
        where: { id: userId },
        data: {
          ...(displayName !== undefined ? { displayName } : {}),
          ...(mobile !== undefined ? { mobile } : {}),
          ...(dto.isBanned !== undefined
            ? {
                isBanned: dto.isBanned,
                bannedAt: dto.isBanned ? new Date() : null,
              }
            : {}),
        },
        select: {
          id: true,
          mobile: true,
          displayName: true,
          referralCode: true,
          role: true,
          isBanned: true,
          bannedAt: true,
          bestScore: true,
          totalGameScore: true,
          referralPoints: true,
          createdAt: true,
          _count: { select: { gameSessions: true, referrals: true } },
        },
      });
      if (dto.isBanned === true) {
        await transaction.userSession.deleteMany({ where: { userId } });
      }
      return updated;
    });
    const { _count, ...fields } = user;
    return {
      data: {
        ...fields,
        bannedAt: fields.bannedAt?.toISOString() ?? null,
        createdAt: fields.createdAt.toISOString(),
        totalScore: fields.totalGameScore + fields.referralPoints,
        totalGames: _count.gameSessions,
        referralCount: _count.referrals,
      },
    };
  }
}
