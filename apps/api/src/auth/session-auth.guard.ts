import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthenticatedRequest } from './auth.types';

@Injectable()
export class SessionAuthGuard implements CanActivate {
  constructor(private readonly auth: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const token = this.auth.readSessionToken(request);

    if (!token) throw new UnauthorizedException('برای بازی وارد حساب شوید');

    request.user = await this.auth.authenticateSession(token);
    request.sessionToken = token;
    return true;
  }
}
