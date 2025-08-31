// src/employer-profile/employer-profile.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EmployerProfile } from './entities/employer-profile.entity';
import { UpsertEmployerProfileDto } from './dto/create-employer-profile.dto';
import { User } from 'src/users/users.entity';

@Injectable()
export class EmployerProfilesService {
  constructor(
    @InjectRepository(EmployerProfile) private repo: Repository<EmployerProfile>,
    @InjectRepository(User) private users: Repository<User>,
  ) {}

  async getMine(userId: number) {
    const prof = await this.repo.findOne({ where: { userId } });
    return prof ?? null;
  }

  /** 🔧 Define what “complete” means for onboarding */
  private isProfileComplete(p?: EmployerProfile | null) {
    if (!p) return false;
    // 👉 Adjust these fields to your schema / DTO
    return Boolean(p.companyName && p.companyPhone && p.city && p.industryType);
  }

  async upsertMine(userId: number, dto: UpsertEmployerProfileDto & { step?: number }) {
    let prof = await this.repo.findOne({ where: { userId } });
    if (!prof) {
      prof = this.repo.create({ userId, ...dto });
    } else {
      Object.assign(prof, dto);
    }
    prof = await this.repo.save(prof);

    // Keep user onboarding flags in sync
    const user = await this.users.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    // Optional: bump step forward if the frontend passes it
    if (typeof dto.step === 'number') {
      user.onboardingStep = Math.max(user.onboardingStep ?? 0, dto.step);
    }

    const complete = this.isProfileComplete(prof);
    if (complete && !user.isOnboarded) {
      user.isOnboarded = true;
    }
    await this.users.save(user);

    return prof;
  }

  /** 👇 For frontend guards */
  async getStatus(userId: number) {
    const user = await this.users.findOne({ where: { id: userId } });
    const profile = await this.getMine(userId);
    const complete = this.isProfileComplete(profile);
    return {
      role: user?.role,
      isOnboarded: Boolean(user?.isOnboarded || complete),
      onboardingStep: user?.onboardingStep ?? 0,
      complete,
    };
  }
}
