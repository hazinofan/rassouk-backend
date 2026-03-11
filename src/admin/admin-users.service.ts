import {
  BadRequestException,
  Injectable,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import { MailService } from 'src/mail/mail.service';
import { User } from 'src/users/users.entity';
import { Repository } from 'typeorm';
import { AdminBanUserDto } from './dto/admin-ban-user.dto';
import { AdminCreateAdminUserDto } from './dto/admin-create-admin-user.dto';
import { AdminUserQueryDto } from './dto/admin-user-query.dto';

@Injectable()
export class AdminUsersService {
  constructor(
    @InjectRepository(User)
    private readonly usersRepo: Repository<User>,
    private readonly mail: MailService,
  ) {}

  private generateTempPassword(length = 12) {
    const chars =
      'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%';
    let value = '';
    for (let i = 0; i < length; i++) {
      value += chars[Math.floor(Math.random() * chars.length)];
    }
    return value;
  }

  async list(query: AdminUserQueryDto) {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(query.limit) || 20));
    const skip = (page - 1) * limit;

    const qb = this.usersRepo.createQueryBuilder('u');

    if (query.q?.trim()) {
      const term = `%${query.q.trim()}%`;
      qb.andWhere('(u.email LIKE :term OR u.name LIKE :term)', { term });
    }
    if (query.role) {
      qb.andWhere('u.role = :role', { role: query.role });
    }
    if (query.status === 'banned') {
      qb.andWhere('u.isBanned = true');
    } else if (query.status === 'active') {
      qb.andWhere('u.isBanned = false');
    }

    qb.orderBy(`u.${query.sortBy ?? 'createdAt'}`, query.sortDir ?? 'DESC');
    qb.skip(skip).take(limit);

    const [items, total] = await qb.getManyAndCount();

    return {
      data: items.map((u) => ({
        id: u.id,
        email: u.email,
        name: u.name,
        role: u.role,
        isBanned: u.isBanned,
        bannedAt: u.bannedAt,
        bannedUntil: u.bannedUntil,
        bannedReason: u.bannedReason,
        createdAt: u.createdAt,
        updatedAt: u.updatedAt,
      })),
      total,
      page,
      limit,
    };
  }

  async getById(id: number) {
    const user = await this.usersRepo.findOne({
      where: { id },
      relations: {
        profile: true,
        candidateProfile: {
          resumes: true,
          educations: true,
          experiences: true,
        },
      },
    });
    if (!user) throw new NotFoundException('User not found');
    const { passwordHash, refreshTokenHash, ...safe } = user as any;
    return safe;
  }

  async createAdmin(dto: AdminCreateAdminUserDto) {
    const email = dto.email.trim().toLowerCase();
    const existing = await this.usersRepo.findOne({ where: { email }, withDeleted: true });
    if (existing) {
      throw new ConflictException('Email already in use');
    }

    const plainPassword = dto.password?.trim() || this.generateTempPassword();
    const passwordHash = await bcrypt.hash(plainPassword, 10);

    const created = await this.usersRepo.save(
      this.usersRepo.create({
        email,
        name: dto.name.trim(),
        passwordHash,
        role: 'admin',
        emailVerified: true,
        isOnboarded: true,
        onboardingStep: 0,
        isBanned: false,
        bannedAt: null,
        bannedUntil: null,
        bannedReason: null,
        bannedByUserId: null,
      }),
    );

    try {
      await this.mail.sendAdminCredentialsEmail({
        to: email,
        name: created.name,
        email,
        password: plainPassword,
      });
    } catch (err) {
      await this.usersRepo.delete(created.id);
      throw err;
    }

    return { ok: true, id: created.id, email: created.email };
  }

  async banUser(id: number, dto: AdminBanUserDto, actorUserId: number) {
    if (id === actorUserId) {
      throw new BadRequestException('You cannot ban yourself');
    }
    const user = await this.usersRepo.findOne({ where: { id } });
    if (!user) throw new NotFoundException('User not found');

    const until = dto.until ? new Date(dto.until) : null;
    if (until && Number.isNaN(until.getTime())) {
      throw new BadRequestException('Invalid until date');
    }

    user.isBanned = true;
    user.bannedAt = new Date();
    user.bannedUntil = until;
    user.bannedReason = dto.reason.trim();
    user.bannedByUserId = actorUserId;
    await this.usersRepo.save(user);

    return { ok: true };
  }

  async unbanUser(id: number) {
    const user = await this.usersRepo.findOne({ where: { id } });
    if (!user) throw new NotFoundException('User not found');

    user.isBanned = false;
    user.bannedAt = null;
    user.bannedUntil = null;
    user.bannedReason = null;
    user.bannedByUserId = null;
    await this.usersRepo.save(user);

    return { ok: true };
  }

  async deleteUser(id: number, actorUserId: number) {
    if (id === actorUserId) {
      throw new BadRequestException('You cannot delete yourself');
    }
    const user = await this.usersRepo.findOne({ where: { id } });
    if (!user) throw new NotFoundException('User not found');
    await this.usersRepo.softDelete(id);
    return { ok: true };
  }
}
