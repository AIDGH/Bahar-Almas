import { ConfigService } from '@nestjs/config';
import { Response } from 'express';
import { EnvironmentVariables } from '../config/environment';
import { PrismaService } from '../database/prisma.service';
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
