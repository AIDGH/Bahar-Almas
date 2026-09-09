import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  createHash,
  createHmac,
  randomBytes,
  randomInt,
  timingSafeEqual,
} from 'node:crypto';
import { Request, Response } from 'express';
import { EnvironmentVariables } from '../config/environment';
import { PrismaService } from '../database/prisma.service';
import { AuthMode, UserRole } from '../generated/prisma/enums';
import { normalizeDigits, normalizeIranianMobile } from './auth-normalization';
import { RequestOtpDto } from './dto/request-otp.dto';

const SESSION_COOKIE = 'bahar_almas_session';
const MAX_OTP_ATTEMPTS = 5;
const REFERRAL_REWARD_POINTS = 1_000;

type RequestMetadata = { userAgent?: string; ipAddress?: string };

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService<EnvironmentVariables, true>,
  ) {}

  async requestOtp(dto: RequestOtpDto) {
    const mobile = normalizeIranianMobile(dto.mobile);
    const displayName = dto.displayName?.trim().replace(/\s+/g, ' ');
    const existingUser = await this.prisma.user.findUnique({
      where: { mobile },
      select: { id: true, isBanned: true },
    });
    if (existingUser?.isBanned) {
      throw new ForbiddenException('این شماره از شرکت در مسابقه مسدود شده است');
    }
    if (dto.mode === 'login' && !existingUser) {
      throw new BadRequestException(
        'حسابی با این شماره پیدا نشد؛ ابتدا ثبت‌نام کنید',
      );
    }
    if (dto.mode === 'register' && existingUser) {
      throw new ConflictException(
        'این شماره قبلاً ثبت‌نام شده؛ از بخش ورود استفاده کنید',
      );
    }
    if (dto.mode === 'register' && !displayName) {
      throw new BadRequestException('برای ساخت حساب، نام نمایشی را وارد کنید');
    }

    const referrer = dto.referralCode
      ? await this.prisma.user.findUnique({
          where: { referralCode: dto.referralCode.trim().toUpperCase() },
          select: { id: true, isBanned: true },
        })
      : null;
    if (
      dto.mode === 'register' &&
      dto.referralCode &&
      (!referrer || referrer.isBanned)
    ) {
      throw new BadRequestException('کد معرف پیدا نشد');
    }

    const code = randomInt(100000, 1000000).toString();
    const ttlMinutes = this.config.get('AUTH_OTP_TTL_MINUTES', { infer: true });
    const challenge = await this.prisma.otpChallenge.create({
      data: {
        mobile,
        displayName: dto.mode === 'register' ? displayName : null,
        authMode: dto.mode === 'register' ? AuthMode.REGISTER : AuthMode.LOGIN,
        referrerId: dto.mode === 'register' ? referrer?.id : null,
        codeHash: this.hashOtp(mobile, code),
        expiresAt: new Date(Date.now() + ttlMinutes * 60_000),
      },
    });

    return {
      data: {
        mobile,
        expiresInSeconds: ttlMinutes * 60,
        ...(this.config.get('OTP_DELIVERY_MODE', { infer: true }) === 'preview'
          ? { developmentCode: code }
          : {}),
        challengeId: challenge.id,
      },
    };
  }

  async verifyOtp(
    mobileValue: string,
    codeValue: string,
    metadata: RequestMetadata,
  ) {
    const mobile = normalizeIranianMobile(mobileValue);
    const code = normalizeDigits(codeValue);
    const challenge = await this.prisma.otpChallenge.findFirst({
      where: { mobile, consumedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: 'desc' },
    });
    if (!challenge || challenge.attempts >= MAX_OTP_ATTEMPTS) {
      throw new UnauthorizedException('کد تأیید معتبر نیست یا منقضی شده');
    }

    const expected = Buffer.from(challenge.codeHash, 'hex');
    const supplied = Buffer.from(this.hashOtp(mobile, code), 'hex');
    if (
      expected.length !== supplied.length ||
      !timingSafeEqual(expected, supplied)
    ) {
      await this.prisma.otpChallenge.update({
        where: { id: challenge.id },
        data: { attempts: { increment: 1 } },
      });
      throw new UnauthorizedException('کد تأیید درست نیست');
    }

    const referralCode =
      challenge.authMode === AuthMode.REGISTER
        ? await this.createUniqueReferralCode()
        : null;
    const user = await this.prisma.$transaction(async (transaction) => {
      await transaction.otpChallenge.update({
        where: { id: challenge.id },
        data: { consumedAt: new Date() },
      });
      if (challenge.authMode === AuthMode.LOGIN) {
        const existingUser = await transaction.user.findUnique({
          where: { mobile },
        });
        if (!existingUser) {
          throw new UnauthorizedException('حساب کاربری پیدا نشد');
        }
        if (existingUser.isBanned) {
          throw new ForbiddenException(
            'این حساب از شرکت در مسابقه مسدود شده است',
          );
        }
        return existingUser;
      }

      const referrer = challenge.referrerId
        ? await transaction.user.findUnique({
            where: { id: challenge.referrerId },
            select: { id: true },
          })
        : null;
      const createdUser = await transaction.user.create({
        data: {
          mobile,
          displayName: challenge.displayName ?? `بازیکن ${mobile.slice(-4)}`,
          referralCode: referralCode!,
          referredById: referrer?.id,
        },
      });

      if (referrer) {
        await transaction.referralReward.create({
          data: {
            referrerId: referrer.id,
            referredUserId: createdUser.id,
            points: REFERRAL_REWARD_POINTS,
          },
        });
        await transaction.user.update({
          where: { id: referrer.id },
          data: { referralPoints: { increment: REFERRAL_REWARD_POINTS } },
        });
      }

      return createdUser;
    });

    return this.createSession(user, metadata);
  }

  async authenticateSession(token: string) {
    const session = await this.prisma.userSession.findFirst({
      where: { tokenHash: hashToken(token), expiresAt: { gt: new Date() } },
      select: {
        user: { select: { id: true, role: true, isBanned: true } },
      },
    });
    if (!session) throw new UnauthorizedException('نشست شما منقضی شده است');
    if (session.user.isBanned) {
      await this.prisma.userSession.deleteMany({
        where: { userId: session.user.id },
      });
      throw new ForbiddenException('این حساب از شرکت در مسابقه مسدود شده است');
    }
    return { id: session.user.id, role: session.user.role };
  }

  async getCurrentUser(userId: string) {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: {
        id: true,
        mobile: true,
        displayName: true,
        referralCode: true,
        bestScore: true,
        totalGameScore: true,
        referralPoints: true,
        role: true,
        isBanned: true,
      },
    });
    return {
      data: {
        ...user,
        totalScore: user.totalGameScore + user.referralPoints,
      },
    };
  }

  async logout(token: string | undefined): Promise<void> {
    if (!token) return;
    await this.prisma.userSession.deleteMany({
      where: { tokenHash: hashToken(token) },
    });
  }

  readSessionToken(request: Request): string | undefined {
    const cookieHeader = request.headers.cookie;
    if (!cookieHeader) return undefined;
    return cookieHeader
      .split(';')
      .map((part) => part.trim().split('='))
      .find(([name]) => name === SESSION_COOKIE)?.[1];
  }

  setSessionCookie(response: Response, token: string, expiresAt: Date): void {
    response.cookie(SESSION_COOKIE, token, {
      httpOnly: true,
      secure: this.config.get('AUTH_COOKIE_SECURE', { infer: true }),
      sameSite: 'lax',
      path: '/',
      expires: expiresAt,
    });
  }

  clearSessionCookie(response: Response): void {
    response.clearCookie(SESSION_COOKIE, {
      httpOnly: true,
      secure: this.config.get('AUTH_COOKIE_SECURE', { infer: true }),
      sameSite: 'lax',
      path: '/',
    });
  }

  private async createSession(
    user: {
      id: string;
      mobile: string;
      displayName: string;
      referralCode: string;
      bestScore: number;
      totalGameScore: number;
      referralPoints: number;
      role: UserRole;
      isBanned: boolean;
    },
    metadata: RequestMetadata,
  ) {
    const token = randomBytes(32).toString('base64url');
    const days = this.config.get('AUTH_SESSION_DAYS', { infer: true });
    const expiresAt = new Date(Date.now() + days * 86_400_000);
    await this.prisma.$transaction([
      this.prisma.userSession.deleteMany({
        where: { userId: user.id, expiresAt: { lte: new Date() } },
      }),
      this.prisma.userSession.create({
        data: {
          userId: user.id,
          tokenHash: hashToken(token),
          expiresAt,
          userAgent: metadata.userAgent?.slice(0, 500),
          ipAddress: metadata.ipAddress?.slice(0, 64),
        },
      }),
    ]);
    return {
      token,
      expiresAt,
      data: {
        id: user.id,
        mobile: user.mobile,
        displayName: user.displayName,
        referralCode: user.referralCode,
        bestScore: user.bestScore,
        totalGameScore: user.totalGameScore,
        referralPoints: user.referralPoints,
        role: user.role,
        isBanned: user.isBanned,
        totalScore: user.totalGameScore + user.referralPoints,
      },
    };
  }

  private hashOtp(mobile: string, code: string): string {
    return createHmac(
      'sha256',
      this.config.get('AUTH_OTP_SECRET', { infer: true }),
    )
      .update(`${mobile}:${code}`)
      .digest('hex');
  }

  private async createUniqueReferralCode(): Promise<string> {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const code = randomBytes(5).toString('hex').toUpperCase();
      const exists = await this.prisma.user.findUnique({
        where: { referralCode: code },
        select: { id: true },
      });
      if (!exists) return code;
    }
    throw new HttpException(
      'ساخت کد معرف انجام نشد؛ دوباره تلاش کنید',
      HttpStatus.SERVICE_UNAVAILABLE,
    );
  }
}

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
