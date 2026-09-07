import {
  BadRequestException,
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
import { normalizeDigits, normalizeIranianMobile } from './auth-normalization';
import { RequestOtpDto } from './dto/request-otp.dto';

const SESSION_COOKIE = 'bahar_almas_session';
const MAX_OTP_ATTEMPTS = 5;

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
      select: { id: true },
    });
    if (!existingUser && !displayName) {
      throw new BadRequestException('برای ساخت حساب، نام نمایشی را وارد کنید');
    }

    const resendSeconds = this.config.get('AUTH_OTP_RESEND_SECONDS', {
      infer: true,
    });
    const latest = await this.prisma.otpChallenge.findFirst({
      where: { mobile, consumedAt: null },
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true },
    });
    if (
      latest &&
      Date.now() - latest.createdAt.getTime() < resendSeconds * 1000
    ) {
      throw new HttpException(
        'کمی صبر کنید و دوباره کد بگیرید',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const code = randomInt(100000, 1000000).toString();
    const ttlMinutes = this.config.get('AUTH_OTP_TTL_MINUTES', { infer: true });
    const challenge = await this.prisma.otpChallenge.create({
      data: {
        mobile,
        displayName: existingUser ? null : displayName,
        codeHash: this.hashOtp(mobile, code),
        expiresAt: new Date(Date.now() + ttlMinutes * 60_000),
      },
    });

    return {
      data: {
        mobile,
        expiresInSeconds: ttlMinutes * 60,
        resendAfterSeconds: resendSeconds,
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

    const user = await this.prisma.$transaction(async (transaction) => {
      await transaction.otpChallenge.update({
        where: { id: challenge.id },
        data: { consumedAt: new Date() },
      });
      return transaction.user.upsert({
        where: { mobile },
        create: {
          mobile,
          displayName: challenge.displayName ?? `بازیکن ${mobile.slice(-4)}`,
        },
        update: {},
      });
    });

    return this.createSession(user, metadata);
  }

  async authenticateSession(token: string) {
    const session = await this.prisma.userSession.findFirst({
      where: { tokenHash: hashToken(token), expiresAt: { gt: new Date() } },
      select: { user: { select: { id: true } } },
    });
    if (!session) throw new UnauthorizedException('نشست شما منقضی شده است');
    return session.user;
  }

  async getCurrentUser(userId: string) {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { id: true, mobile: true, displayName: true, bestScore: true },
    });
    return { data: user };
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
      bestScore: number;
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
        bestScore: user.bestScore,
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
}

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
