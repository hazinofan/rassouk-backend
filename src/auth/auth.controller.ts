import {
  BadRequestException,
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
import { UsersService } from 'src/users/users.service';
import { EntitlementsService } from 'src/subscriptions/entitlements.service';
import * as crypto from 'crypto';

@Controller('auth')
export class AuthController {
  constructor(
    private authService: AuthService,
    private cfg: ConfigService,
    private usersService: UsersService,
    private entitlements: EntitlementsService,
  ) {}

  private getCookieOptions(path = '/') {
    const secure = process.env.NODE_ENV === 'production';
    return {
      httpOnly: true,
      secure,
      sameSite: 'lax' as const,
      path,
    };
  }

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
      ...this.getCookieOptions('/'),
      maxAge: 1000 * 60 * 60 * 6, // 6 hours
    });

    res.cookie('refresh_token', refreshToken, {
      ...this.getCookieOptions('/auth'),
      maxAge: 1000 * 60 * 60 * 24 * 7, // 7 days
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
    const state = crypto.randomBytes(24).toString('hex');
    res.cookie('google_oauth_state', state, {
      ...this.getCookieOptions('/auth'),
      maxAge: 1000 * 60 * 10,
    });

    const params = new URLSearchParams({
      client_id: this.cfg.get<string>('GOOGLE_CLIENT_ID')!,
      redirect_uri: this.cfg.get<string>('GOOGLE_REDIRECT_URI')!,
      response_type: 'code',
      scope: 'openid email profile',
      access_type: 'online',
      prompt: 'consent',
      state,
    });
    res.redirect(
      `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`,
    );
  }

  @Get('google/callback')
  async googleCallback(
    @Query('code') code: string,
    @Query('state') state: string,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    if (!code) {
      throw new BadRequestException('Missing Google authorization code');
    }

    const expectedState = req.cookies?.['google_oauth_state'];
    if (!state || !expectedState || state !== expectedState) {
      throw new BadRequestException('Invalid Google OAuth state');
    }

    const { accessToken, refreshToken } =
      await this.authService.handleGoogleCode(code);

    res.clearCookie('google_oauth_state', this.getCookieOptions('/auth'));

    res.cookie('access_token', accessToken, {
      ...this.getCookieOptions('/'),
      maxAge: 1000 * 60 * 60 * 6,
    });

    res.cookie('refresh_token', refreshToken, {
      ...this.getCookieOptions('/auth'),
      maxAge: 1000 * 60 * 60 * 24 * 7,
    });

    return res.redirect(`${this.cfg.get('WEB_URL')}/oauth-success`);
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
      ...this.getCookieOptions('/'),
      maxAge: 1000 * 60 * 60 * 6, // 6 hours
    });

    // optional rotation of refresh token
    res.cookie('refresh_token', refreshToken, {
      ...this.getCookieOptions('/auth'),
      maxAge: 1000 * 60 * 60 * 24 * 7,
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
  async me(@Req() req: Request & { user?: any }) {
    const userId = Number(req.user?.id);
    const user = await this.usersService.findById(userId);
    const billing = await this.entitlements.getBillingSnapshot(userId);

    return {
      id: user?.id ?? req.user?.id,
      email: user?.email ?? req.user?.email,
      role: user?.role ?? req.user?.role,
      name: user?.name ?? req.user?.name,
      isOnboarded: user?.isOnboarded ?? req.user?.isOnboarded,
      onboardingStep: user?.onboardingStep ?? 0,
      billing,
    };
  }
}
