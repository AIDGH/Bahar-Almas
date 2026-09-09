import {
  ConflictException,
  ForbiddenException,
  HttpException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac } from 'node:crypto';
import { Response } from 'express';
import { EnvironmentVariables } from '../config/environment';
import { PrismaService } from '../database/prisma.service';
import { AuthMode, UserRole } from '../generated/prisma/enums';
import { AuthService } from './auth.service';

describe('AuthService session cookie', () => {
  it('allows the temporary HTTP QA deployment to omit Secure', () => {
    const { cookie, response, service } = createService(false);
    const expiresAt = new Date('2026-09-08T00:00:00.000Z');

    service.setSessionCookie(response, 'token', expiresAt);

    expect(cookie).toHaveBeenCalledWith(
      'bahar_almas_session',
      'token',
      expect.objectContaining({
        httpOnly: true,
        secure: false,
        sameSite: 'lax',
        path: '/',
        expires: expiresAt,
      }),
    );
  });

  it('keeps the public HTTPS deployment cookie Secure', () => {
    const { clearCookie, response, service } = createService(true);

    service.clearSessionCookie(response);

    expect(clearCookie).toHaveBeenCalledWith(
      'bahar_almas_session',
      expect.objectContaining({
        httpOnly: true,
        secure: true,
        sameSite: 'lax',
        path: '/',
      }),
    );
  });
});

describe('AuthService banned sessions', () => {
  it('revokes sessions and rejects banned users', async () => {
    const deleteMany = jest.fn().mockResolvedValue({ count: 1 });
    const prisma = {
      userSession: {
        findFirst: jest.fn().mockResolvedValue({
          user: {
            id: 'banned-user',
            role: UserRole.USER,
            isBanned: true,
          },
        }),
        deleteMany,
      },
    } as unknown as PrismaService;
    const service = new AuthService(prisma, {
      get: jest.fn(),
    } as unknown as ConfigService<EnvironmentVariables, true>);

    await expect(service.authenticateSession('session-token')).rejects.toThrow(
      ForbiddenException,
    );
    expect(deleteMany).toHaveBeenCalledWith({
      where: { userId: 'banned-user' },
    });
  });
});

describe('AuthService OTP requests', () => {
  it('blocks fresh administrator login while production exposes preview OTP codes', async () => {
    const queryRaw = jest.fn();
    const prisma = {
      user: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'admin-id',
          role: UserRole.ADMIN,
          isBanned: false,
        }),
      },
      $queryRaw: queryRaw,
    } as unknown as PrismaService;
    const service = new AuthService(
      prisma,
      createAuthConfig(undefined, 'production'),
    );

    await expect(
      service.requestOtp({ mode: 'login', mobile: '09123456789' }),
    ).rejects.toThrow(ForbiddenException);
    expect(queryRaw).not.toHaveBeenCalled();
  });

  it('allows two requests and rate-limits the third request for one minute', async () => {
    const blockedUntil = new Date(Date.now() + 60_000);
    const createChallenge = jest.fn().mockResolvedValue({
      id: 'challenge-id',
    });
    const prisma = {
      user: { findUnique: jest.fn().mockResolvedValue(null) },
      otpChallenge: {
        create: createChallenge,
      },
      $queryRaw: jest
        .fn()
        .mockResolvedValueOnce([{ blockedUntil: null }])
        .mockResolvedValueOnce([{ blockedUntil: null }])
        .mockResolvedValueOnce([{ blockedUntil }]),
    } as unknown as PrismaService;
    const service = new AuthService(prisma, createAuthConfig());
    const input = {
      mode: 'register' as const,
      mobile: '09123456789',
      displayName: 'بازیکن تست',
    };

    await expect(service.requestOtp(input)).resolves.toBeDefined();
    await expect(service.requestOtp(input)).resolves.toBeDefined();
    const thirdRequestError = await service
      .requestOtp(input)
      .catch((error: unknown) => error);
    expect(thirdRequestError).toBeInstanceOf(HttpException);
    expect((thirdRequestError as HttpException).getStatus()).toBe(429);
    const response = (thirdRequestError as HttpException).getResponse() as {
      retryAfterSeconds: number;
    };
    expect(typeof response.retryAfterSeconds).toBe('number');
    expect(createChallenge).toHaveBeenCalledTimes(2);
  });

  it('rejects registration immediately when the mobile already has an account', async () => {
    const prisma = {
      user: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'existing-user',
          isBanned: false,
        }),
      },
    } as unknown as PrismaService;
    const service = new AuthService(prisma, createAuthConfig());

    await expect(
      service.requestOtp({
        mode: 'register',
        mobile: '09123456789',
        displayName: 'بازیکن تست',
      }),
    ).rejects.toThrow(ConflictException);
  });

  it('rejects a stale registration challenge if the mobile was created meanwhile', async () => {
    const secret = 'test-otp-secret-that-is-long-enough';
    const mobile = '09123456789';
    const code = '123456';
    const challenge = {
      id: 'challenge-id',
      mobile,
      displayName: 'بازیکن تست',
      authMode: AuthMode.REGISTER,
      referrerId: null,
      attempts: 0,
      codeHash: createHmac('sha256', secret)
        .update(`${mobile}:${code}`)
        .digest('hex'),
    };
    const transaction = {
      otpChallenge: { update: jest.fn().mockResolvedValue(challenge) },
      user: {
        createMany: jest.fn().mockResolvedValue({ count: 0 }),
        findUniqueOrThrow: jest.fn(),
      },
    };
    const runTransaction = jest.fn(
      async (
        callback: (client: typeof transaction) => Promise<unknown>,
      ): Promise<unknown> => callback(transaction),
    );
    const prisma = {
      otpChallenge: { findFirst: jest.fn().mockResolvedValue(challenge) },
      user: { findUnique: jest.fn().mockResolvedValue(null) },
      $transaction: runTransaction,
    } as unknown as PrismaService;
    const service = new AuthService(prisma, createAuthConfig(secret));

    await expect(service.verifyOtp(mobile, code, {})).rejects.toThrow(
      ConflictException,
    );
    expect(transaction.user.createMany).toHaveBeenCalledWith({
      data: [expect.objectContaining({ role: UserRole.USER })],
      skipDuplicates: true,
    });
    expect(transaction.user.findUniqueOrThrow).not.toHaveBeenCalled();
  });

  it('blocks an already issued administrator challenge in production preview mode', async () => {
    const secret = 'test-otp-secret-that-is-long-enough';
    const mobile = '09123456789';
    const code = '123456';
    const challenge = {
      id: 'challenge-id',
      mobile,
      authMode: AuthMode.LOGIN,
      attempts: 0,
      codeHash: createHmac('sha256', secret)
        .update(`${mobile}:${code}`)
        .digest('hex'),
    };
    const transaction = {
      otpChallenge: { update: jest.fn().mockResolvedValue(challenge) },
      user: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'admin-id',
          role: UserRole.ADMIN,
          isBanned: false,
        }),
      },
    };
    const runTransaction = jest.fn(
      async (
        callback: (client: typeof transaction) => Promise<unknown>,
      ): Promise<unknown> => callback(transaction),
    );
    const prisma = {
      otpChallenge: { findFirst: jest.fn().mockResolvedValue(challenge) },
      $transaction: runTransaction,
    } as unknown as PrismaService;
    const service = new AuthService(
      prisma,
      createAuthConfig(secret, 'production'),
    );

    await expect(service.verifyOtp(mobile, code, {})).rejects.toThrow(
      ForbiddenException,
    );
  });
});

function createService(cookieSecure: boolean) {
  const prisma = {} as PrismaService;
  const config = {
    get: jest.fn((key: keyof EnvironmentVariables) => {
      if (key === 'AUTH_COOKIE_SECURE') return cookieSecure;
      return undefined;
    }),
  } as unknown as ConfigService<EnvironmentVariables, true>;
  const cookie = jest.fn();
  const clearCookie = jest.fn();
  const response = {
    cookie,
    clearCookie,
  } as unknown as Response;

  return {
    clearCookie,
    cookie,
    response,
    service: new AuthService(prisma, config),
  };
}

function createAuthConfig(
  secret = 'test-otp-secret-that-is-long-enough',
  nodeEnvironment: EnvironmentVariables['NODE_ENV'] = 'test',
) {
  return {
    get: jest.fn((key: keyof EnvironmentVariables) => {
      if (key === 'NODE_ENV') return nodeEnvironment;
      if (key === 'AUTH_OTP_TTL_MINUTES') return 5;
      if (key === 'AUTH_OTP_SECRET') return secret;
      if (key === 'OTP_DELIVERY_MODE') return 'preview';
      return undefined;
    }),
  } as unknown as ConfigService<EnvironmentVariables, true>;
}
