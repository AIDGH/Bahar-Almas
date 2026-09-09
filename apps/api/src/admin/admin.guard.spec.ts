import {
  BadRequestException,
  ExecutionContext,
  ForbiddenException,
  ValidationPipe,
} from '@nestjs/common';
import { AuthenticatedRequest } from '../auth/auth.types';
import { RequestOtpDto } from '../auth/dto/request-otp.dto';
import { UserRole } from '../generated/prisma/enums';
import { AdminGuard } from './admin.guard';
import { UpdateAdminUserDto } from './dto/update-admin-user.dto';

describe('AdminGuard', () => {
  const guard = new AdminGuard();

  it('allows administrators', () => {
    expect(guard.canActivate(contextFor(UserRole.ADMIN))).toBe(true);
  });

  it('rejects regular users', () => {
    expect(() => guard.canActivate(contextFor(UserRole.USER))).toThrow(
      ForbiddenException,
    );
  });
});

describe('administrator role input security', () => {
  const pipe = new ValidationPipe({
    transform: true,
    whitelist: true,
    forbidNonWhitelisted: true,
  });

  it('rejects role injection during public registration', async () => {
    await expect(
      pipe.transform(
        {
          mode: 'register',
          mobile: '09123456789',
          displayName: 'کاربر تست',
          role: 'ADMIN',
        },
        { type: 'body', metatype: RequestOtpDto },
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects role changes through the administrator user editor', async () => {
    await expect(
      pipe.transform(
        { displayName: 'کاربر تست', role: 'ADMIN' },
        { type: 'body', metatype: UpdateAdminUserDto },
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});

function contextFor(role: UserRole): ExecutionContext {
  const request = { user: { id: 'user-id', role } } as AuthenticatedRequest;
  return {
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
}
