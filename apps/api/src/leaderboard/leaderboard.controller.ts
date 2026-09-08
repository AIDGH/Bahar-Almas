import {
  Controller,
  DefaultValuePipe,
  Get,
  ParseIntPipe,
  Query,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';
import { AuthService } from '../auth/auth.service';
import { LeaderboardService } from './leaderboard.service';

@Controller('leaderboard')
export class LeaderboardController {
  constructor(
    private readonly leaderboard: LeaderboardService,
    private readonly auth: AuthService,
  ) {}

  @Get()
  async getPlayers(
    @Req() request: Request,
    @Query('limit', new DefaultValuePipe(10), new ParseIntPipe()) limit: number,
    @Query('offset', new DefaultValuePipe(0), new ParseIntPipe())
    offset: number,
  ) {
    const token = this.auth.readSessionToken(request);
    const currentUser = token
      ? await this.auth.authenticateSession(token).catch(() => undefined)
      : undefined;
    return this.leaderboard.getPlayers(
      Math.min(Math.max(limit, 3), 50),
      Math.max(offset, 0),
      currentUser?.id,
    );
  }
}
