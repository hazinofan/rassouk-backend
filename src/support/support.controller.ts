import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { CurrentUser } from 'src/auth/decorators/current-user.decoratoe';
import { RolesGuard } from 'src/auth/decorators/roles.guard';
import { JwtAuthGuard } from 'src/auth/guards/jwt.guard';
import { SendSupportMessageDto } from './dto/send-support-message.dto';
import { SupportService } from './support.service';

@Controller('support')
@UseGuards(JwtAuthGuard, RolesGuard)
export class SupportController {
  constructor(private readonly supportService: SupportService) {}

  @Post('message')
  sendMessage(@CurrentUser() user: any, @Body() dto: SendSupportMessageDto) {
    return this.supportService.sendMessage(user.id, dto);
  }
}
