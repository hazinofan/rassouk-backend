// src/auth/password-reset.service.ts
import { Injectable, BadRequestException, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThan } from 'typeorm';
import { UsersService } from '../users/users.service';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import * as crypto from 'crypto';
import * as bcrypt from 'bcrypt';
import { MailService } from '../mail/mail.service'; 
import { PasswordResetToken } from './password-reset-token.entity';

const RESET_TOKEN_TTL_MIN = 30;
const MAX_REQUESTS_PER_HOUR = 3;  

@Injectable()
export class PasswordResetService {
  constructor(
    @InjectRepository(PasswordResetToken) private prRepo: Repository<PasswordResetToken>,
    private users: UsersService,
    private mail: MailService,
  ) {}

  private hashToken(raw: string) {
    return crypto.createHash('sha256').update(raw).digest('hex');
  }

  async requestReset(dto: ForgotPasswordDto, ip?: string, ua?: string) {
    // Always return OK to avoid email enumeration
    const user = await this.users.findByEmail(dto.email).catch(() => null);
    if (!user) return;

    // simple throttle
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const recentCount = await this.prRepo.count({
      where: { user: { id: user.id }, createdAt: MoreThan(oneHourAgo) },
    });
    if (recentCount >= MAX_REQUESTS_PER_HOUR) return;

    // generate opaque token (raw), store only hash
    const raw = crypto.randomBytes(32).toString('hex'); // 64 chars
    const tokenHash = this.hashToken(raw);
    const expiresAt = new Date(Date.now() + RESET_TOKEN_TTL_MIN * 60 * 1000);

    const record = this.prRepo.create({
      user,
      tokenHash,
      expiresAt,
      requestIp: ip || null,
      requestUa: ua || null,
    });
    await this.prRepo.save(record);

    // Email the raw token using your MailService
    await this.mail.sendResetPasswordEmail(user.email, raw);
  }

  async resetPassword(dto: ResetPasswordDto) {
    if (!dto.token) throw new BadRequestException('Invalid token');

    const tokenHash = this.hashToken(dto.token);
    const now = new Date();

    const record = await this.prRepo.findOne({
      where: { tokenHash },
      relations: ['user'],
    });

    if (!record || record.usedAt || record.expiresAt < now) {
      throw new ForbiddenException('Token invalid or expired');
    }

    const newHash = await bcrypt.hash(dto.password, 10); // bcrypt instead of argon2
    await this.users.updatePassword(record.user.id, newHash);

    record.usedAt = now;
    await this.prRepo.save(record);
  }

  async changePassword(userId: number, dto: ChangePasswordDto) {
    const user = await this.users.findById(userId);
    if (!user) throw new NotFoundException();

    const ok = await bcrypt.compare(dto.currentPassword, user.passwordHash); // bcrypt verify
    if (!ok) throw new ForbiddenException('Current password is incorrect');

    const newHash = await bcrypt.hash(dto.newPassword, 10); // bcrypt hash new
    await this.users.updatePassword(user.id, newHash);
  }
}
