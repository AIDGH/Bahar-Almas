import { ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Response } from 'express';
import { EnvironmentVariables } from '../config/environment';
import { PrismaService } from '../database/prisma.service';
import { UserRole } from '../generated/prisma/enums';
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
  it('allows an immediate replacement OTP request', async () => {
    const create = jest
      .fn()
      .mockResolvedValueOnce({ id: 'first-challenge' })
      .mockResolvedValueOnce({ id: 'second-challenge' });
    const prisma = {
      user: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'active-user',
          isBanned: false,
        }),
      },
      otpChallenge: { create },
    } as unknown as PrismaService;
    const config = {
      get: jest.fn((key: keyof EnvironmentVariables) => {
        if (key === 'AUTH_OTP_SECRET') {
          return 'bahar-almas-otp-test-secret-long-enough';
        }
        if (key === 'AUTH_OTP_TTL_MINUTES') return 5;
        if (key === 'OTP_DELIVERY_MODE') return 'preview';
        return undefined;
      }),
    } as unknown as ConfigService<EnvironmentVariables, true>;
    const service = new AuthService(prisma, config);

    await service.requestOtp({ mode: 'login', mobile: '09912184701' });
    await service.requestOtp({ mode: 'login', mobile: '09912184701' });

    expect(create).toHaveBeenCalledTimes(2);
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
