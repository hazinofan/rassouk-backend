import {
  Injectable,
  BadRequestException,
  UnauthorizedException,
} from '@nestjs/common';
import { UsersService } from 'src/users/users.service';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as crypto from 'crypto';
import * as bcrypt from 'bcrypt';
import { EmailToken } from './email-token.entity';
import { SignupDto } from './dto/signup.dto';
import { LoginDto } from './dto/login.dto';
import { MailService } from 'src/mail/mail.service';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { User } from 'src/users/users.entity';

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private cfg: ConfigService,
    private readonly jwt: JwtService,
    @InjectRepository(EmailToken) private emailTokens: Repository<EmailToken>,
    private mail: MailService,
  ) {}

  private signAccess(user: { id: number; email: string; role: string; isOnboarded?: boolean, name: string }) {
    const payload = { sub: user.id, email: user.email, role: user.role, isOnboarded: user.isOnboarded, name: user.name };
    return this.jwt.signAsync(payload, {
      secret: this.cfg.get<string>('JWT_ACCESS_SECRET'),
      expiresIn: '24h',
      algorithm: 'HS256',
      // issuer/audience only if you also verify them
    });
  }

  private signRefresh(user: { id: number }) {
    const payload = { sub: user.id, type: 'refresh' };
    return this.jwt.signAsync(payload, {
      secret: this.cfg.get<string>('JWT_REFRESH_SECRET'),
      expiresIn: '7d',
      algorithm: 'HS256',
    });
  }

  private async saveRefreshToken(user: { id: number }, refreshToken: string) {
    const hash = await bcrypt.hash(refreshToken, 10);
    await this.usersService.setRefreshTokenHash(user.id, hash);
  }

  async signup(dto: SignupDto) {
    const email = dto.email.toLowerCase().trim();
    const existing = await this.usersService.findByEmail(email);
    if (existing) throw new BadRequestException('Email déjà utilisé');

    const passwordHash = await bcrypt.hash(dto.password, 10);
    const name = dto.name
    const role =
      dto.role === 'employer' || dto.role === 'admin' ? dto.role : 'candidat';

    // ⬇️ Onboarding now applies to BOTH employer and candidat (not admin)
    const requiresOnboarding = role !== 'admin';

    const user = await this.usersService.create({
      email,
      passwordHash,
      role,
      name,
      isOnboarded: requiresOnboarding ? false : true,
      onboardingStep: 0,
    });

    // Email verification token
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 24 * 3600 * 1000);

    await this.emailTokens.save(
      this.emailTokens.create({ user, token, expiresAt }),
    );
    await this.mail.sendVerificationEmail(user.email, token);

    return {
      message: 'Utilisateur créé. Vérifie ton email pour activer ton compte.',
      user: { id: user.id, email: user.email, role: user.role },
      // ⬇️ Frontend can use this to decide redirect after email verify/login
      needsOnboarding: requiresOnboarding,
    };
  }

  async verifyEmail(token: string) {
    const record = await this.emailTokens.findOne({
      where: { token },
      relations: ['user'],
    });
    if (!record) throw new BadRequestException('Token invalide');
    if (record.expiresAt < new Date())
      throw new BadRequestException('Token expiré');

    await this.usersService.verifyEmail(record.user.id);
    await this.emailTokens.delete(record.id);

    return { message: 'Email vérifié avec succès ✅' };
  }

  async login(dto: LoginDto) {
    const email = dto.email.toLowerCase().trim();
    const user = await this.usersService.findByEmail(email);
    if (!user) throw new UnauthorizedException('Identifiants invalides');

    const valid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!valid) throw new UnauthorizedException('Identifiants invalides');

    if (!user.emailVerified)
      throw new UnauthorizedException('Email non vérifié');

    const accessToken = await this.signAccess(user);
    const refreshToken = await this.signRefresh(user);
    await this.saveRefreshToken(user, refreshToken);

    return {
      message: 'Connexion réussie',
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        isOnboarded: user.isOnboarded,
        onboardingStep: user.onboardingStep,
      },
      accessToken,
      refreshToken,
      // ⬇️ Non-admin users need onboarding if not completed
      needsOnboarding: user.role !== 'admin' && !user.isOnboarded,
    };
  }

  async handleGoogleCode(code: string) {
    // 1) Exchange code for tokens
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: this.cfg.get('GOOGLE_CLIENT_ID')!,
        client_secret: this.cfg.get('GOOGLE_CLIENT_SECRET')!,
        redirect_uri: this.cfg.get('GOOGLE_REDIRECT_URI')!,
        grant_type: 'authorization_code',
      }),
    }).then((r) => r.json() as any);

    const idToken = tokenRes.id_token as string;
    if (!idToken) throw new Error('No id_token from Google');

    // 2) Decode ID token (quick decode)
    const payload = JSON.parse(
      Buffer.from(idToken.split('.')[1], 'base64').toString(),
    );
    const email = String(payload.email ?? '')
      .toLowerCase()
      .trim();
    if (!email) throw new Error('Google profile has no email');

    // 3) Find or create user + mark verified (no password needed for Google, but your schema requires one)
    let user = await this.usersService.findByEmail(email);
    if (!user) {
      const randomPassword = crypto.randomBytes(10).toString('hex');
      const passwordHash = await bcrypt.hash(randomPassword, 10);

      user = await this.usersService.create({
        email,
        passwordHash,
        role: 'candidat',
        isOnboarded: false,
        onboardingStep: 0,
      });

      await this.usersService.verifyEmail(user.id);
    }

    const accessToken = await this.signAccess(user);
    const refreshToken = await this.signRefresh(user);
    await this.saveRefreshToken(user, refreshToken);

    return { accessToken, refreshCookie: refreshToken };
  }

  async refresh(refreshToken?: string) {
    if (!refreshToken) throw new UnauthorizedException('No refresh token');

    // 1) Verify JWT
    let payload: { sub: number; type?: string; email?: string };
    try {
      payload = (await this.jwt.verifyAsync(refreshToken, {
        secret: this.cfg.get<string>('JWT_REFRESH_SECRET')!,
      })) as any;
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }

    // optional: type guard
    if (payload.type !== 'refresh') {
      throw new UnauthorizedException('Not a refresh token');
    }

    // 2) Load user
    const user = await this.usersService.findById(payload.sub);
    if (!user) throw new UnauthorizedException('User not found');

    // 3) (Optional but recommended) Check stored hash matches
    //    Uncomment when you implement saveRefreshToken() to persist a hash
    const storedHash = await this.usersService.getRefreshTokenHash(user.id);
    if (!storedHash || !(await bcrypt.compare(refreshToken, storedHash))) {
      throw new UnauthorizedException('Refresh token mismatch');
    }

    // 4) Rotate tokens
    const accessToken = await this.signAccess(user);
    const newRefresh = await this.signRefresh(user);

    // If you persist hashes, update it:
    await this.saveRefreshToken(user, newRefresh);

    return {
      user: { id: user.id, email: user.email, role: user.role },
      accessToken,
      refreshToken: newRefresh,
    };
  }
}
