import {
  Body,
  Controller,
  Get,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { AuthService } from './auth.service';
import type { AuthenticatedRequest } from './auth.types';
import { RequestOtpDto } from './dto/request-otp.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { SessionAuthGuard } from './session-auth.guard';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('otp/request')
  requestOtp(@Body() dto: RequestOtpDto) {
    return this.auth.requestOtp(dto);
  }

  @Post('otp/verify')
  async verifyOtp(
    @Body() dto: VerifyOtpDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.auth.verifyOtp(dto.mobile, dto.code, {
      userAgent: request.headers['user-agent'],
      ipAddress: request.ip,
    });
    this.auth.setSessionCookie(response, result.token, result.expiresAt);
    return { data: result.data };
  }

  @Get('me')
  @UseGuards(SessionAuthGuard)
  getMe(@Req() request: AuthenticatedRequest) {
    return this.auth.getCurrentUser(request.user.id);
  }

  @Post('logout')
  async logout(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    await this.auth.logout(this.auth.readSessionToken(request));
    this.auth.clearSessionCookie(response);
    return { data: { success: true } };
  }
}
