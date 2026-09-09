import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { AuthenticatedRequest } from '../auth/auth.types';
import { UserRole } from '../generated/prisma/enums';

@Injectable()
export class AdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    if (request.user.role !== UserRole.ADMIN) {
      throw new ForbiddenException('دسترسی ادمین لازم است');
    }
    return true;
  }
}
