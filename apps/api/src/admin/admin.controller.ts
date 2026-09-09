import {
  Body,
  Controller,
  DefaultValuePipe,
  Get,
  Param,
  ParseIntPipe,
  ParseUUIDPipe,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';
import { SessionAuthGuard } from '../auth/session-auth.guard';
import { AdminGuard } from './admin.guard';
import { AdminService } from './admin.service';
import { UpdateAdminUserDto } from './dto/update-admin-user.dto';

@Controller('admin')
@UseGuards(SessionAuthGuard, AdminGuard)
export class AdminController {
  constructor(private readonly admin: AdminService) {}

  @Get('users')
  getUsers(
    @Query('limit', new DefaultValuePipe(25), new ParseIntPipe()) limit: number,
    @Query('offset', new DefaultValuePipe(0), new ParseIntPipe())
    offset: number,
    @Query('search') search = '',
  ) {
    return this.admin.getUsers(
      Math.min(Math.max(limit, 1), 50),
      Math.max(offset, 0),
      search,
    );
  }

  @Patch('users/:id')
  updateUser(
    @Param('id', new ParseUUIDPipe()) userId: string,
    @Body() dto: UpdateAdminUserDto,
  ) {
    return this.admin.updateUser(userId, dto);
  }
}
