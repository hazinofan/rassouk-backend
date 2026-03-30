import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  EMPLOYER_PROFILE_TABLE,
  EmployerProfile,
} from './entities/employer-profile.entity';
import { UpsertEmployerProfileDto } from './dto/create-employer-profile.dto';
import { User } from 'src/users/users.entity';

@Injectable()
export class EmployerProfilesService {
  private readonly logger = new Logger(EmployerProfilesService.name);

  private readonly requiredCreateFields: (keyof UpsertEmployerProfileDto)[] = [
    'companyName',
    'about',
    'industryType',
    'teamSize',
    'contactEmail',
  ];

  private readonly nullableStringFields: (keyof UpsertEmployerProfileDto)[] = [
    'logoUrl',
    'bannerUrl',
    'about',
    'industryType',
    'websiteUrl',
    'vision',
    'facebookUrl',
    'instagramUrl',
    'twitterUrl',
    'linkedinUrl',
    'address',
    'city',
    'companyPhone',
    'employerPhone',
    'contactEmail',
  ];

  constructor(
    @InjectRepository(EmployerProfile) private repo: Repository<EmployerProfile>,
    @InjectRepository(User) private users: Repository<User>,
  ) {}

  async getMine(userId: number) {
    const prof = await this.repo.findOne({ where: { userId } });
    return prof ?? null;
  }

  private isProfileComplete(p?: EmployerProfile | null) {
    if (!p) return false;
    return Boolean(p.companyName && p.companyPhone && p.city && p.industryType);
  }

  async upsertMine(userId: number, dto: UpsertEmployerProfileDto & { step?: number }) {
    this.assertExpectedTableMapping();

    const normalized = this.normalizeInput(dto);

    let prof = await this.repo.findOne({ where: { userId } });
    if (!prof) {
      this.assertRequiredCreateFields(normalized);
      prof = this.repo.create({ userId, ...normalized });
    } else {
      Object.assign(prof, normalized);
    }

    prof = await this.repo.save(prof);

    const user = await this.users.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    if (typeof normalized.step === 'number') {
      user.onboardingStep = Math.max(user.onboardingStep ?? 0, normalized.step);
    }

    const complete = this.isProfileComplete(prof);
    if (complete && !user.isOnboarded) {
      user.isOnboarded = true;
    }

    await this.users.save(user);
    return prof;
  }

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

  private assertExpectedTableMapping() {
    const mappedTable = this.repo.metadata?.tableName ?? '';
    if (mappedTable !== EMPLOYER_PROFILE_TABLE) {
      throw new InternalServerErrorException(
        `Employer profile table mapping mismatch. Expected "${EMPLOYER_PROFILE_TABLE}", got "${mappedTable || '<empty>'}"`,
      );
    }

    this.logger.debug(`Employer profile writes use table "${mappedTable}"`);
  }

  private assertRequiredCreateFields(
    dto: UpsertEmployerProfileDto & { step?: number },
  ) {
    const missing = this.requiredCreateFields.filter((field) => {
      const value = dto[field];
      return (
        value === null ||
        value === undefined ||
        (typeof value === 'string' && value.trim().length === 0)
      );
    });

    if (missing.length > 0) {
      throw new BadRequestException(
        `Missing required onboarding fields: ${missing.join(', ')}`,
      );
    }
  }

  private normalizeInput(dto: UpsertEmployerProfileDto & { step?: number }) {
    const normalized: UpsertEmployerProfileDto & { step?: number } = { ...dto };

    for (const field of this.nullableStringFields) {
      if (!(field in normalized)) continue;

      const rawValue = normalized[field];
      if (typeof rawValue !== 'string') continue;

      const trimmed = rawValue.trim();
      normalized[field] = (trimmed.length > 0 ? trimmed : null) as never;
    }

    if (typeof normalized.companyName === 'string') {
      normalized.companyName = normalized.companyName.trim();
      if (normalized.companyName.length === 0) {
        throw new BadRequestException('companyName cannot be empty');
      }
    }

    if ('yearEstablished' in normalized) {
      normalized.yearEstablished = this.normalizeYearEstablished(
        normalized.yearEstablished,
      ) as never;
    }

    return normalized;
  }

  private normalizeYearEstablished(value: unknown): string | null | undefined {
    if (value === undefined) return undefined;
    if (value === null) return null;

    const raw = String(value).trim();
    if (!raw) return null;

    if (/^\d{4}$/.test(raw)) {
      const year = Number(raw);
      const currentYear = new Date().getFullYear();
      if (year < 1900 || year > currentYear) {
        throw new BadRequestException(
          `yearEstablished must be between 1900 and ${currentYear}`,
        );
      }
      return `${raw}-01-01`;
    }

    const parsed = new Date(raw);
    if (Number.isNaN(parsed.getTime())) {
      throw new BadRequestException(
        'yearEstablished must be a valid ISO date or a 4-digit year',
      );
    }

    return parsed.toISOString().slice(0, 10);
  }
}
