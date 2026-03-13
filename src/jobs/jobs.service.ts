import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  DeepPartial,
  Not,
  Repository,
} from 'typeorm';
import { CreateJobDto } from './dto/create-job.dto';
import { UpdateJobDto } from './dto/update-job.dto';
import { QueryJobDto } from './dto/query-job.dto';
import slugify from 'slugify';
import {
  Job,
  JobLevel,
  JobModerationStatus,
  JobStatus,
  JobType,
} from './entities/job.entity';
import { ApplicationStatus } from 'src/applications/entities/application.entity';
import { EntitlementsService } from 'src/subscriptions/entitlements.service';
import { JobRefreshEvent } from './entities/job-refresh-event.entity';

function parseSalary(label?: string): { min?: number; max?: number } {
  if (!label) return {};
  // normalize: remove currency tokens & thousands separators, unify dash
  const s = String(label)
    .replace(/mad/gi, '') // drop MAD
    .replace(/\$/g, '') // drop $
    .replace(/\s+/g, '') // drop spaces (e.g. "2 500" -> "2500")
    .replace(/,/g, '') // drop commas
    .replace(/[–—]/g, '-') // en/em dash to hyphen
    .trim();

  // "50000+"
  const plus = /^(\d+)\+$/.exec(s);
  if (plus) return { min: Number(plus[1]) };

  // "2500-5000"
  const range = /^(\d+)-(\d+)$/.exec(s);
  if (range) {
    const min = Number(range[1]);
    const max = Number(range[2]);
    if (Number.isFinite(min) && Number.isFinite(max)) return { min, max };
  }

  return {};
}

function expLabel(v?: string): string | null {
  if (!v) return null;
  if (v === '0') return 'Freshers';
  if (v.endsWith('+')) return v.replace('+', '+'); // "15+"
  // normalize to "4 - 6" etc.
  return v.replace('-', ' - ');
}

const normalizeType = (v: string): JobType | null => {
  if (!v) return null;
  const raw = String(v).trim();

  // if it's already an enum, keep it
  if ((Object.values(JobType) as string[]).includes(raw)) {
    return raw as JobType;
  }

  // map UI labels -> enum
  const x = raw.toLowerCase();
  if (x === 'full time') return JobType.FULL_TIME;
  if (x === 'part time') return JobType.PART_TIME;
  if (x === 'internship') return JobType.INTERNSHIP;
  if (x === 'contract base' || x === 'contract') return JobType.CONTRACT;
  if (x === 'freelance') return JobType.FREELANCE;
  return null;
};

const isJobType = (t: JobType | null): t is JobType => t !== null;

function isNonEmptyArray<T>(v: T[] | undefined | null): v is T[] {
  return Array.isArray(v) && v.length > 0;
}

@Injectable()
export class JobsService {
  constructor(
    @InjectRepository(Job) private repo: Repository<Job>,
    @InjectRepository(JobRefreshEvent)
    private refreshEventsRepo: Repository<JobRefreshEvent>,
    private readonly entitlements: EntitlementsService,
  ) {}

  private makeSlug(title: string) {
    const base = slugify(title, { lower: true, strict: true, trim: true });
    return `${base}-${Math.random().toString(36).slice(2, 7)}`;
  }

  private toDateOrUndef(v: unknown): Date | undefined {
    if (v == null || v === '') return undefined;
    const d = v instanceof Date ? v : new Date(String(v));
    return isNaN(d.getTime()) ? undefined : d;
  }
  private toDecString(v: unknown): string | undefined {
    if (v == null || v === '') return undefined;
    const n = typeof v === 'number' ? v : Number(v);
    if (!Number.isFinite(n)) return undefined;
    // format to 2 decimals to respect scale: 2
    return n.toFixed(2);
  }

  async create(dto: CreateJobDto, employerId: number) {
    const activeJobs = await this.countActiveJobs(employerId);
    await this.entitlements.assertEmployerLimit(
      employerId,
      'max_active_jobs',
      activeJobs,
    );

    if (
      dto.minSalary &&
      dto.maxSalary &&
      Number(dto.minSalary) > Number(dto.maxSalary)
    ) {
      throw new BadRequestException('minSalary must be <= maxSalary');
    }
    await this.assertPremiumVisibilityAccess(employerId, dto);

    const job = this.repo.create({
      ...dto,
      minSalary: this.toDecString(dto.minSalary),
      maxSalary: this.toDecString(dto.maxSalary),
      expiresAt: this.toDateOrUndef(dto.expiresAt),
      boostedUntil: this.toDateOrUndef(dto.boostedUntil),
      slug: this.makeSlug(dto.title),
      visibleAt: new Date(),
      lastRefreshedAt: null,
      employer: { id: employerId } as any,
    } as DeepPartial<Job>);

    if (dto.isFeatured) {
      const currentFeatured = await this.countFeaturedJobs(employerId);
      await this.entitlements.assertEmployerLimit(
        employerId,
        'max_featured_jobs',
        currentFeatured,
      );
    }

    return this.repo.save(job);
  }

  async findPublic(qs: QueryJobDto) {
    const {
      q,
      role,
      type,
      types,
      level,
      location,
      exp,
      salary,
      education,
      remote,
      tags,
      page = 1,
      limit = 20,
      sort = 'new',
    } = qs;

    const qb = this.repo
      .createQueryBuilder('job')
      .leftJoinAndSelect('job.employer', 'employer')
      .leftJoinAndSelect('employer.profile', 'profile')
      .where('job.status = :status', { status: JobStatus.ACTIVE })
      .andWhere('job.moderationStatus = :moderationStatus', {
        moderationStatus: JobModerationStatus.APPROVED,
      })
      .andWhere('(job.expiresAt IS NULL OR job.expiresAt >= NOW())');

    // Free-text (MySQL case-insensitive)
    if (q && q.trim()) {
      const term = `%${q.trim().toLowerCase()}%`;
      qb.andWhere(
        `(
          LOWER(job.title) LIKE :q
          OR LOWER(COALESCE(job.description, '')) LIKE :q
          OR LOWER(COALESCE(job.responsibilities, '')) LIKE :q
        )`,
        { q: term },
      );
    }

    // Role
    if (role && role.trim()) {
      qb.andWhere('LOWER(job.role) LIKE :role', {
        role: `%${role.trim().toLowerCase()}%`,
      });
    }

    const toArray = (v: unknown): string[] => {
      if (Array.isArray(v)) {
        return v
          .flatMap((item) => String(item).split(','))
          .map((s) => s.trim())
          .filter(Boolean);
      }
      if (typeof v === 'string' && v.trim().length) {
        // support CSV like ?level=JUNIOR,MID
        return v
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean);
      }
      return [];
    };

    // Level (OR inside group)
    const levelList = toArray(level)
      .map((v) => v.toUpperCase())
      .filter((v): v is JobLevel =>
        (['JUNIOR', 'MID', 'SENIOR', 'LEAD'] as string[]).includes(v),
      );
    if (levelList.length) {
      qb.andWhere('job.jobLevel IN (:...levelList)', {
        levelList: Array.from(new Set(levelList)),
      });
    }

    // Location
    if (location && location.trim()) {
      qb.andWhere('LOWER(job.location) LIKE :loc', {
        loc: `%${location.trim().toLowerCase()}%`,
      });
    }

    // Job Types (UI labels -> enum)
    const allTypeInputsRaw: string[] = [
      ...(Array.isArray(types) ? types : types ? [types] : []),
      ...(type ? [type] : []),
      ...(qs.jobType ? [qs.jobType] : []), // <-- include jobType alias
    ];

    const typeList = allTypeInputsRaw
      .map(normalizeType) // map UI label ("Full Time") → enum ("FULL_TIME")
      .filter(isJobType); // drop nulls

    if (typeList.length) {
      qb.andWhere('job.jobType IN (:...typeList)', { typeList });
    }

    // Remote only (textual)
    if (String(remote).toLowerCase() === 'true') {
      qb.andWhere('LOWER(job.location) LIKE :remote', { remote: '%remote%' });
    }

    // Experience (OR inside group)
    const expList = toArray(exp).map(expLabel).filter(Boolean) as string[];
    if (expList.length) {
      const params: Record<string, string> = {};
      const clauses = expList.map((value, i) => {
        const key = `exp_${i}`;
        params[key] = `%${value.toLowerCase()}%`;
        return `LOWER(job.experience) LIKE :${key}`;
      });
      qb.andWhere(`(${clauses.join(' OR ')})`, params);
    }

    const eduSelected = toArray(education);
    const tagSelected = toArray(tags);

    if (eduSelected.length) {
      const EDU_NORM = `LOWER(REPLACE(REPLACE(job.education, ' ', ''), '+', ''))`;
      const EDU_MAP: Record<string, string[]> = {
        'High School': ['highschool', 'bac', 'college', 'bac2'],
        Intermediate: ['intermediate', 'prepa', 'prépa'],
        Graduation: ['graduation', 'graduate'],
        'Bachelor Degree': ['bachelor', 'licence', 'license', 'bac3'],
        'Master Degree': ['master', 'msc', 'ma', 'bac5'],
      };

      const selected = eduSelected.filter((e) => e && e !== 'All');
      if (selected.length) {
        const params: Record<string, string> = {};
        const groups = selected.map((label, gi) => {
          const terms = (EDU_MAP[label] ?? [label]).map((t) =>
            t.toLowerCase().replace(/\s+/g, '').replace(/\+/g, ''),
          );
          const ors = terms
            .map((_, ti) => `${EDU_NORM} LIKE :edu_${gi}_${ti}`)
            .join(' OR ');
          terms.forEach((t, ti) => (params[`edu_${gi}_${ti}`] = `%${t}%`));
          return `(${ors})`;
        });
        // OR between selected levels (typical UX)
        qb.andWhere(groups.join(' OR '), params);
      }
    }

    qb.addSelect('COALESCE(job.maxSalary, job.minSalary)', 'job_effSalary');

    // Salary ranges (OR inside group)
    const salaryList = toArray(salary).map(parseSalary);
    const salaryClauses: string[] = [];
    const salaryParams: Record<string, number> = {};
    salaryList.forEach(({ min, max }, i) => {
      if (min != null && max != null) {
        salaryClauses.push(
          `(COALESCE(job.minSalary, 0) <= :smax_${i} AND COALESCE(job.maxSalary, job.minSalary) >= :smin_${i})`,
        );
        salaryParams[`smin_${i}`] = min;
        salaryParams[`smax_${i}`] = max;
      } else if (min != null) {
        salaryClauses.push(
          `COALESCE(job.maxSalary, job.minSalary) >= :smin_${i}`,
        );
        salaryParams[`smin_${i}`] = min;
      }
    });
    if (salaryClauses.length) {
      qb.andWhere(`(${salaryClauses.join(' OR ')})`, salaryParams);
    }

    if (isNonEmptyArray(tags)) {
      const lowerTags = tags.map((t) => String(t).toLowerCase());
      const ors = lowerTags
        .map((_, i) => `CONCAT(',', LOWER(job.tags), ',') LIKE :tag${i}`)
        .join(' OR ');
      const params = Object.fromEntries(
        lowerTags.map((t, i) => [`tag${i}`, `%,${t},%`]),
      );
      qb.andWhere(`(${ors})`, params);
    }

    // Sorting
    qb.addSelect(
      'CASE WHEN job.boostedUntil IS NOT NULL AND job.boostedUntil >= NOW() THEN 1 ELSE 0 END',
      'job_hasActiveBoost',
    );
    qb.addSelect(
      'COALESCE(job.visibleAt, job.createdAt)',
      'job_visibilityDate',
    );
    if (sort === 'salary') {
      qb.orderBy('job.isFeatured', 'DESC')
        .addOrderBy('job_hasActiveBoost', 'DESC')
        .addOrderBy('job.isUrgent', 'DESC')
        .addOrderBy('job_effSalary', 'DESC')
        .addOrderBy('job_visibilityDate', 'DESC');
    } else if (sort === 'oldest') {
      qb.orderBy('job.isFeatured', 'DESC')
        .addOrderBy('job_hasActiveBoost', 'DESC')
        .addOrderBy('job.isUrgent', 'DESC')
        .addOrderBy('job_visibilityDate', 'ASC');
    } else {
      qb.orderBy('job.isFeatured', 'DESC')
        .addOrderBy('job_hasActiveBoost', 'DESC')
        .addOrderBy('job.isUrgent', 'DESC')
        .addOrderBy('job_visibilityDate', 'DESC')
        .addOrderBy('job.createdAt', 'DESC');
    }

    // Pagination (cap limit to 100)
    const take = Math.min(100, Number(limit) || 20);
    const skip = (Number(page) > 1 ? Number(page) - 1 : 0) * take;
    qb.take(take).skip(skip);

    const [data, total] = await qb.getManyAndCount();

    return { data, total, page: Number(page), limit: take };
  }

  async findOneBySlug(slug: string) {
    const job = await this.repo.findOne({
      where: {
        slug,
        status: JobStatus.ACTIVE,
        moderationStatus: JobModerationStatus.APPROVED,
      },
      relations: { employer: { profile: true } },
    });
    if (!job) throw new NotFoundException('Job not found');
    return job;
  }

  async findMine(employerId: number, page = 1, limit = 20) {
    const take = Math.min(Math.max(+limit || 20, 1), 100);
    const skip = (Math.max(+page || 1, 1) - 1) * take;

    const qb = this.repo
      .createQueryBuilder('job')
      .where('job.employerId = :employerId', { employerId })
      .orderBy('job.createdAt', 'DESC')
      .take(take)
      .skip(skip)
      // Count applications for each job (filter statuses if you want)
      .loadRelationCountAndMap(
        'job.applicationsCount',
        'job.applications',
        'app',
        // Example: exclude WITHDRAWN from the count; remove this block to count all
        (sub) =>
          sub.andWhere('app.status != :withdrawn', {
            withdrawn: ApplicationStatus.WITHDRAWN,
          }),
      );

    const [items, total] = await qb.getManyAndCount();

    // If you expose plain JSON (no class-transformer), map the count to a field:
    const data = items.map((j: any) => ({
      id: j.id,
      title: j.title,
      slug: j.slug,
      jobType: j.jobType,
      status: j.status,
      isUrgent: j.isUrgent ?? false,
      isFeatured: j.isFeatured ?? false,
      boostedUntil: j.boostedUntil ?? null,
      visibleAt: j.visibleAt ?? j.createdAt,
      createdAt: j.createdAt,
      expiresAt: j.expiresAt,
      applicationsCount: j.applicationsCount ?? 0,
    }));

    return { data, total, page: +page, limit: take };
  }

  async update(id: number, employerId: number, dto: UpdateJobDto) {
    const job = await this.repo.findOne({
      where: { id, employer: { id: employerId } },
    });
    if (!job) throw new NotFoundException('Job not found or not yours');

    await this.assertPremiumVisibilityAccess(employerId, dto);

    const setFeaturedOn =
      dto.isFeatured === true && !job.isFeatured;
    if (setFeaturedOn) {
      const currentFeatured = await this.countFeaturedJobs(employerId, job.id);
      await this.entitlements.assertEmployerLimit(
        employerId,
        'max_featured_jobs',
        currentFeatured,
      );
    }

    if (dto.title) job.slug = this.makeSlug(dto.title);
    const boostedUntil =
      dto.boostedUntil !== undefined
        ? this.toDateOrUndef(dto.boostedUntil) ?? null
        : job.boostedUntil;
    Object.assign(job, {
      ...dto,
      boostedUntil,
    });
    return this.repo.save(job);
  }

  async softDelete(id: number, employerId: number) {
    const job = await this.repo.findOne({
      where: { id, employer: { id: employerId } },
    });
    if (!job) throw new NotFoundException('Job not found or not yours');
    await this.repo.softDelete(job.id);
    return { success: true };
  }

  // cron-friendly auto-expire
  async expirePast() {
    await this.repo
      .createQueryBuilder()
      .update(Job)
      .set({ status: JobStatus.EXPIRED })
      .where('expiresAt <= NOW()')
      .andWhere('status = :s', { s: JobStatus.ACTIVE })
      .execute();
  }

  async updateStatus(id: number, employerId: number, status: JobStatus) {
    const job = await this.repo.findOne({
      where: { id, employer: { id: employerId } },
    });
    if (!job) throw new NotFoundException('Job not found or not yours');

    // Only touch status
    if (job.status === status) return job;

    if (status === JobStatus.ACTIVE) {
      const activeJobs = await this.countActiveJobs(employerId, job.id);
      await this.entitlements.assertEmployerLimit(
        employerId,
        'max_active_jobs',
        activeJobs,
      );
      job.visibleAt = new Date();
    }

    if (status === JobStatus.PAUSED) {
      if (job.status !== JobStatus.ACTIVE) {
        throw new BadRequestException('Only active jobs can be paused');
      }
    }

    job.status = status;
    return this.repo.save(job);
  }

  async pause(id: number, employerId: number) {
    return this.updateStatus(id, employerId, JobStatus.PAUSED);
  }

  async resume(id: number, employerId: number) {
    return this.updateStatus(id, employerId, JobStatus.ACTIVE);
  }

  async duplicate(id: number, employerId: number) {
    const source = await this.repo.findOne({
      where: { id, employer: { id: employerId } },
    });
    if (!source) throw new NotFoundException('Job not found or not yours');

    const cloned = this.repo.create({
      title: source.title,
      description: source.description,
      responsibilities: source.responsibilities,
      tags: source.tags,
      role: source.role,
      minSalary: source.minSalary,
      maxSalary: source.maxSalary,
      salaryType: source.salaryType,
      jobType: source.jobType,
      jobLevel: source.jobLevel,
      education: source.education,
      experience: source.experience,
      vacancies: source.vacancies,
      currency: source.currency,
      location: source.location,
      moderationStatus: source.moderationStatus,
      moderationNote: source.moderationNote,
      moderatedAt: source.moderatedAt,
      moderatedByUserId: source.moderatedByUserId,
      isUrgent: source.isUrgent,
      isFeatured: source.isFeatured,
      boostedUntil: source.boostedUntil ?? undefined,
      slug: this.makeSlug(source.title),
      status: JobStatus.DRAFT,
      visibleAt: undefined,
      lastRefreshedAt: undefined,
      expiresAt: undefined,
      employer: { id: employerId } as any,
    } as DeepPartial<Job>);

    return this.repo.save(cloned);
  }

  async refreshOrRepublish(
    id: number,
    employerId: number,
    opts?: { expiresAt?: Date },
  ) {
    await this.entitlements.assertEmployerFeature(employerId, 'job_refresh_enabled');
    await this.entitlements.assertEmployerMonthlyActionLimit(
      employerId,
      'max_job_refreshes_per_month',
    );

    const job = await this.repo.findOne({
      where: { id, employer: { id: employerId } },
    });
    if (!job) throw new NotFoundException('Job not found or not yours');

    if (job.status !== JobStatus.ACTIVE) {
      const activeJobs = await this.countActiveJobs(employerId, job.id);
      await this.entitlements.assertEmployerLimit(
        employerId,
        'max_active_jobs',
        activeJobs,
      );
      job.status = JobStatus.ACTIVE;
    }

    const now = new Date();
    job.visibleAt = now;
    job.lastRefreshedAt = now;

    if (opts?.expiresAt) {
      job.expiresAt = opts.expiresAt;
    }

    await this.repo.save(job);
    await this.refreshEventsRepo.save(
      this.refreshEventsRepo.create({
        employerId,
        employer: { id: employerId } as any,
        jobId: job.id,
        job: { id: job.id } as any,
      }),
    );

    return job;
  }

  private countActiveJobs(employerId: number, excludeJobId?: number) {
    return this.repo.count({
      where: {
        employer: { id: employerId },
        status: JobStatus.ACTIVE,
        ...(excludeJobId ? { id: Not(excludeJobId) } : {}),
      },
    });
  }

  private async countFeaturedJobs(employerId: number, excludeJobId?: number) {
    return this.repo.count({
      where: {
        employer: { id: employerId },
        isFeatured: true,
        ...(excludeJobId ? { id: Not(excludeJobId) } : {}),
      },
    });
  }

  private async assertPremiumVisibilityAccess(
    employerId: number,
    dto: { isUrgent?: boolean; isFeatured?: boolean; boostedUntil?: Date },
  ) {
    if (dto.isUrgent) {
      await this.entitlements.assertEmployerFeature(
        employerId,
        'urgent_jobs_enabled',
      );
    }

    if (dto.isFeatured || dto.boostedUntil) {
      await this.entitlements.assertEmployerFeature(
        employerId,
        'featured_jobs_enabled',
      );
    }
  }
}
