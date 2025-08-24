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

  private async signAccess(user: User) {
    return this.jwt.signAsync(
      { sub: user.id, email: user.email, role: user.role },
      { secret: this.cfg.get('JWT_ACCESS_SECRET'), expiresIn: '15m' },
    );
  }

  private async signRefresh(user: { id: number }) {
    return this.jwt.signAsync(
      { sub: user.id, type: 'refresh' },
      {
        secret: this.cfg.get<string>('JWT_REFRESH_SECRET')!,
        expiresIn: +this.cfg.get<number>('JWT_REFRESH_TTL')! || 2592000, // 30d
      },
    );
  }

  private async saveRefreshToken(_user: { id: number }, _refreshToken: string) {
    // TODO: store hash in DB if you implement rotation/revocation
    return;
  }

  async signup(dto: SignupDto) {
    const email = dto.email.toLowerCase().trim();
    const existing = await this.usersService.findByEmail(email);
    if (existing) throw new BadRequestException('Email déjà utilisé');

    // ✅ hash before save
    const passwordHash = await bcrypt.hash(dto.password, 10);

    // if you added a role column: dto.role or default 'candidat'
    const user = await this.usersService.create({
      email,
      passwordHash,
      role: (dto as any).role ?? 'candidat',
    });

    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 24 * 3600 * 1000);

    await this.emailTokens.save(
      this.emailTokens.create({ user, token, expiresAt }),
    );
    await this.mail.sendVerificationEmail(user.email, token);

    return {
      message: 'Utilisateur créé. Vérifie ton email pour activer ton compte.',
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
      user: { id: user.id, email: user.email, role: user.role },
      accessToken,
      refreshToken,
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

      // ✅ Your UsersService.create now expects ONE object
      user = await this.usersService.create({
        email,
        passwordHash,
        role: 'candidat', // or choose based on your flow
      });

      await this.usersService.verifyEmail(user.id); // mark as verified
    }

    const accessToken = await this.signAccess(user);
    const refreshToken = await this.signRefresh(user);
    await this.saveRefreshToken(user, refreshToken); // no-op if you kept it stateless

    return { accessToken, refreshCookie: refreshToken };
  }
}
