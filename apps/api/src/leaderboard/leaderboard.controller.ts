import {
  Controller,
  DefaultValuePipe,
  Get,
  ParseIntPipe,
  Query,
} from '@nestjs/common';
import { LeaderboardService } from './leaderboard.service';

@Controller('leaderboard')
export class LeaderboardController {
  constructor(private readonly leaderboard: LeaderboardService) {}

  @Get()
  getTopPlayers(
    @Query('limit', new DefaultValuePipe(20), new ParseIntPipe()) limit: number,
  ) {
    return this.leaderboard.getTopPlayers(Math.min(Math.max(limit, 3), 50));
  }
}
