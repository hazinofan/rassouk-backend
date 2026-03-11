import {
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from 'src/auth/guards/jwt.guard';
import { NotificationsService } from './notifications.service';

@UseGuards(JwtAuthGuard)
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get()
  list(@Req() req: any, @Query('page') page?: number, @Query('limit') limit?: number) {
    return this.notifications.listForUser(req.user.id, Number(page), Number(limit));
  }

  @Get('unread-count')
  async unreadCount(@Req() req: any) {
    const count = await this.notifications.unreadCount(req.user.id);
    return { count };
  }

  @Patch('read-all')
  markAll(@Req() req: any) {
    return this.notifications.markAllAsRead(req.user.id);
  }

  @Patch(':id/read')
  markOne(@Req() req: any, @Param('id', ParseIntPipe) id: number) {
    return this.notifications.markOneAsRead(req.user.id, id);
  }
}
