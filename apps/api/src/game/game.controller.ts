import {
  Body,
  Controller,
  Headers,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { SessionAuthGuard } from '../auth/session-auth.guard';
import type { AuthenticatedRequest } from '../auth/auth.types';
import { FinishGameDto } from './dto/finish-game.dto';
import { GameService } from './game.service';

@Controller('games')
export class GameController {
  constructor(private readonly games: GameService) {}

  @Post('start')
  start() {
    return this.games.start();
  }

  @Post(':id/finish')
  finish(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Headers('x-game-token') claimToken: string,
    @Body() dto: FinishGameDto,
  ) {
    return this.games.finish(id, claimToken, dto);
  }

  @Post(':id/claim')
  @UseGuards(SessionAuthGuard)
  claim(
    @Req() request: AuthenticatedRequest,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Headers('x-game-token') claimToken: string,
  ) {
    return this.games.claim(request.user.id, id, claimToken);
  }
}
