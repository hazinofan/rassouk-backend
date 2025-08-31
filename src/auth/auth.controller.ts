import {
  Controller,
  Post,
  Body,
  Get,
  Query,
  Res,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { SignupDto } from './dto/signup.dto';
import { LoginDto } from './dto/login.dto';
import { ConfigService } from '@nestjs/config';
import type { Request, Response } from 'express';
import { JwtAuthGuard } from './guards/jwt.guard';

@Controller('auth')
export class AuthController {
  constructor(
    private authService: AuthService,
    private cfg: ConfigService,
  ) {}

  @Post('signup')
  signup(@Body() dto: SignupDto) {
    return this.authService.signup(dto);
  }

  @Get('verify')
  async verify(@Query('token') token: string, @Res() res: Response) {
    await this.authService.verifyEmail(token);
    return res.redirect(`${process.env.APP_URL}/auth/email-verified`);
  }

  @Post('login')
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { user, accessToken, refreshToken } =
      await this.authService.login(dto);

    // set cookies
    res.cookie('access_token', accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production', // true in prod (HTTPS)
      sameSite: 'lax',
      maxAge: 1000 * 60 * 15, // 15 min
      path: '/',
    });

    res.cookie('refresh_token', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 1000 * 60 * 60 * 24 * 7, // 7 days
      path: '/auth', // optional
    });

    // 👇 send token along with user
    return {
      user,
      accessToken,
      refreshToken,
    };
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
    res.redirect(
      `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`,
    );
  }

  @Get('google/callback')
  async googleCallback(
    @Query('code') code: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { accessToken, refreshCookie } =
      await this.authService.handleGoogleCode(code);

    res.cookie('rt', refreshCookie, {
      httpOnly: true,
      sameSite: 'lax',
      secure: false,
      path: '/auth',
    });

    return res.redirect(
      `${this.cfg.get('WEB_URL')}/oauth-success#at=${accessToken}`,
    );
  }

  @Post('refresh')
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const refresh = req.cookies?.['refresh_token'];
    const { accessToken, refreshToken, user } =
      await this.authService.refresh(refresh);

    res.cookie('access_token', accessToken, {
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      maxAge: 1000 * 60 * 15,
      path: '/',
    });

    // optional rotation of refresh token
    res.cookie('refresh_token', refreshToken, {
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      maxAge: 1000 * 60 * 60 * 24 * 7,
      path: '/auth',
    });

    return { user };
  }

  @Post('logout')
  logout(@Res({ passthrough: true }) res: Response) {
    res.clearCookie('access_token', { path: '/' });
    res.clearCookie('refresh_token', { path: '/auth' });
    return { ok: true };
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  me(@Req() req: Request & { user?: any }) {
    return req.user;
  }
}
