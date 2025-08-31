import { Body, Controller, Ip, Post, Req, UseGuards } from '@nestjs/common';
import { PasswordResetService } from './password-reset.service';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import type { Request } from 'express';
import { JwtAuthGuard } from './guards/jwt.guard';

@Controller('auth')
export class PasswordResetController {
  constructor(private svc: PasswordResetService) {}

  @Post('forgot-password')
  async forgot(@Body() dto: ForgotPasswordDto, @Ip() ip: string, @Req() req: Request) {
    await this.svc.requestReset(dto, ip, req.headers['user-agent']);
    return { ok: true, message: "Si l'e-mail existe, un lien de réinitialisation a été envoyé." };
  }

  @Post('reset-password')
  async reset(@Body() dto: ResetPasswordDto) {
    await this.svc.resetPassword(dto);
    return { ok: true };
  }

  @UseGuards(JwtAuthGuard)
  @Post('change-password')
  async change(@Body() dto: ChangePasswordDto, @Req() req: any) {
    await this.svc.changePassword(req.user.id, dto);
    return { ok: true };
  }
}
