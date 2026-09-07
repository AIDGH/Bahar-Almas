import {
  Body,
  Controller,
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
@UseGuards(SessionAuthGuard)
export class GameController {
  constructor(private readonly games: GameService) {}

  @Post('start')
  start(@Req() request: AuthenticatedRequest) {
    return this.games.start(request.user.id);
  }

  @Post(':id/finish')
  finish(
    @Req() request: AuthenticatedRequest,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: FinishGameDto,
  ) {
    return this.games.finish(request.user.id, id, dto);
  }
}
