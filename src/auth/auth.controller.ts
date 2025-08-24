import { Controller, Post, Body, Get, Query, Res } from '@nestjs/common';
import type { Response } from 'express';   // 👈 type-only import
import { AuthService } from './auth.service';
import { SignupDto } from './dto/signup.dto';
import { LoginDto } from './dto/login.dto';
import { ConfigService } from '@nestjs/config';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService, private cfg: ConfigService) {}

  @Post('signup')
  signup(@Body() dto: SignupDto) {
    return this.authService.signup(dto);
  }

  @Get('verify')
  verify(@Query('token') token: string) {
    return this.authService.verifyEmail(token);
  }

  @Post('login')
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Get('google')
  googleStart(@Res() res: Response) {
    const params = new URLSearchParams({
      client_id: this.cfg.get<string>('GOOGLE_CLIENT_ID')!,
      redirect_uri: this.cfg.get<string>('GOOGLE_REDIRECT_URI')!,
      response_type: 'code',
      scope: 'openid email profile',
      access_type: 'online',
      prompt: 'consent',
    });
    res.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`);
  }

  @Get('google/callback')
  async googleCallback(@Query('code') code: string, @Res({ passthrough: true }) res: Response) {
    const { accessToken, refreshCookie } = await this.authService.handleGoogleCode(code);

    res.cookie('rt', refreshCookie, {
      httpOnly: true,
      sameSite: 'lax',
      secure: false,
      path: '/auth',
    });

    return res.redirect(`${this.cfg.get('WEB_URL')}/oauth-success#at=${accessToken}`);
  }
}
