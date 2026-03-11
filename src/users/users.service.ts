import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DeepPartial, Repository } from 'typeorm';
import { User } from './users.entity';
import * as bcrypt from 'bcrypt';
import { QueryEmployersDto } from './dto/query-employers.dto';

export type UserRole = 'admin' | 'candidat' | 'employer';

@Injectable()
export class UsersService {
  constructor(@InjectRepository(User) private repo: Repository<User>) {}

  // keep your old create
  async create(data: DeepPartial<User>) {
    const user = this.repo.create(data);
    return this.repo.save(user);
  }

  // NEW: create with plaintext password (hash it here)
  async createWithPassword(data: {
    email: string;
    password: string;
    name?: string;
    role?: UserRole;
  }) {
    const passwordHash = await bcrypt.hash(data.password, 10);
    const user = this.repo.create({
      email: data.email,
      name: data.name ?? '',
      role: data.role ?? 'candidat',
      passwordHash,
    } as DeepPartial<User>);
    return this.repo.save(user);
  }

  // NEW: return all users
  async findAll() {
    return this.repo.find({
      relations: {
        candidateProfile: {
          resumes: true,
          educations: true,
          experiences: true,
        },
      },
    });
  }

  async findEmployers(query: QueryEmployersDto = {}) {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(query.limit) || 20));
    const offset = (page - 1) * limit;

    const qb = this.repo
      .createQueryBuilder('u')
      .leftJoinAndSelect('u.profile', 'profile')
      .where('u.role = :role', { role: 'employer' })
      .loadRelationCountAndMap('u.jobsPosted', 'u.jobs')
      .addSelect(
        '(SELECT COUNT(1) FROM jobs jcount WHERE jcount.employerId = u.id AND jcount.deletedAt IS NULL)',
        'jobsCount',
      )
      .skip(offset)
      .take(limit);

    if (query.q?.trim()) {
      const q = `%${query.q.trim().toLowerCase()}%`;
      qb.andWhere(
        `(LOWER(u.name) LIKE :q
          OR LOWER(u.email) LIKE :q
          OR LOWER(COALESCE(profile.companyName, '')) LIKE :q
          OR LOWER(COALESCE(profile.industryType, '')) LIKE :q
          OR LOWER(COALESCE(profile.city, '')) LIKE :q)`,
        { q },
      );
    }

    if (query.city?.trim()) {
      qb.andWhere(`LOWER(COALESCE(profile.city, '')) LIKE :city`, {
        city: `%${query.city.trim().toLowerCase()}%`,
      });
    }

    if (query.industryType?.trim()) {
      qb.andWhere(`LOWER(COALESCE(profile.industryType, '')) LIKE :industryType`, {
        industryType: `%${query.industryType.trim().toLowerCase()}%`,
      });
    }

    const jobsMin = Number(query.jobsMin);
    if (Number.isFinite(jobsMin) && jobsMin >= 0) {
      qb.andWhere(
        `(SELECT COUNT(1) FROM jobs jmin WHERE jmin.employerId = u.id AND jmin.deletedAt IS NULL) >= :jobsMin`,
        { jobsMin },
      );
    }

    const jobsMax = Number(query.jobsMax);
    if (Number.isFinite(jobsMax) && jobsMax >= 0) {
      qb.andWhere(
        `(SELECT COUNT(1) FROM jobs jmax WHERE jmax.employerId = u.id AND jmax.deletedAt IS NULL) <= :jobsMax`,
        { jobsMax },
      );
    }

    switch (query.sort) {
      case 'oldest':
        qb.orderBy('u.createdAt', 'ASC');
        break;
      case 'jobs_asc':
        qb.orderBy('jobsCount', 'ASC').addOrderBy('u.createdAt', 'DESC');
        break;
      case 'jobs_desc':
        qb.orderBy('jobsCount', 'DESC').addOrderBy('u.createdAt', 'DESC');
        break;
      case 'latest':
      default:
        qb.orderBy('u.createdAt', 'DESC');
        break;
    }

    const [items, total] = await qb.getManyAndCount();

    const data = items.map((user) => ({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      isOnboarded: user.isOnboarded,
      onboardingStep: user.onboardingStep,
      jobsPosted: (user as User & { jobsPosted?: number }).jobsPosted ?? 0,
      profile: user.profile
        ? {
            userId: user.profile.userId,
            companyName: user.profile.companyName,
            logoUrl: user.profile.logoUrl,
            bannerUrl: user.profile.bannerUrl,
            city: user.profile.city,
            industryType: user.profile.industryType,
            organizationType: user.profile.organizationType,
            websiteUrl: user.profile.websiteUrl,
          }
        : null,
    }));

    return {
      data,
      total,
      page,
      limit,
      pageCount: Math.ceil(total / limit),
    };
  }

  async findByEmail(email: string) {
    return this.repo.findOne({
      where: { email },
      relations: {
        candidateProfile: {
          resumes: true,
          educations: true,
          experiences: true,
        },
      },
    });
  }

  async findById(id: number) {
    return this.repo.findOne({
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
  }

  async verifyEmail(id: number) {
    await this.repo.update(id, { emailVerified: true });
  }

  async setRefreshTokenHash(userId: number, hash: string) {
    await this.repo.update(userId, { refreshTokenHash: hash });
  }

  async getRefreshTokenHash(userId: number) {
    const u = await this.repo.findOne({
      where: { id: userId },
      select: ['id', 'refreshTokenHash'],
    });
    return u?.refreshTokenHash ?? null;
  }

  async updatePassword(userId: number, passwordHash: string) {
    await this.repo.update(userId, { passwordHash });
  }

  // NEW: partial update (generic)
  async updatePartial(userId: number, patch: any) {
    const data: any = { ...patch };
    if (typeof patch.password === 'string' && patch.password.length > 0) {
      data.passwordHash = await bcrypt.hash(patch.password, 10);
      delete data.password;
    }
    if (typeof data.email === 'string') {
      data.email = data.email.trim().toLowerCase();
    }
    await this.repo.update(userId, data);
    return this.findById(userId);
  }

  // NEW: remove user
  async remove(userId: number) {
    await this.repo.delete(userId);
  }
}
