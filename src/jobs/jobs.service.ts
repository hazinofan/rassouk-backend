import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  DeepPartial,
  ILike,
  LessThanOrEqual,
  MoreThanOrEqual,
  Repository,
} from 'typeorm';
import { CreateJobDto } from './dto/create-job.dto';
import { UpdateJobDto } from './dto/update-job.dto';
import { QueryJobDto } from './dto/query-job.dto';
import slugify from 'slugify';
import { Job, JobStatus, JobType } from './entities/job.entity';

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
  constructor(@InjectRepository(Job) private repo: Repository<Job>) {}

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
    if (
      dto.minSalary &&
      dto.maxSalary &&
      Number(dto.minSalary) > Number(dto.maxSalary)
    ) {
      throw new BadRequestException('minSalary must be <= maxSalary');
    }
    const job = this.repo.create({
      ...dto,
      minSalary: this.toDecString(dto.minSalary),
      maxSalary: this.toDecString(dto.maxSalary),
      expiresAt: this.toDateOrUndef(dto.expiresAt),
      slug: this.makeSlug(dto.title),
      employer: { id: employerId } as any,
    } satisfies DeepPartial<Job>);
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
      .andWhere('(job.expiresAt IS NULL OR job.expiresAt >= NOW())');

    // Free-text (MySQL case-insensitive)
    if (q && q.trim()) {
      qb.andWhere('LOWER(job.title) LIKE :q', {
        q: `%${q.trim().toLowerCase()}%`,
      });
    }

    // Role
    if (role && role.trim()) {
      qb.andWhere('LOWER(job.role) LIKE :role', {
        role: `%${role.trim().toLowerCase()}%`,
      });
    }

    // Level (enum)
    if (level) {
      qb.andWhere('job.jobLevel = :level', { level });
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

    // Experience
    const expStr = expLabel(exp);
    if (expStr) {
      qb.andWhere('LOWER(job.experience) LIKE :exp', {
        exp: `%${expStr.toLowerCase()}%`,
      });
    }

    const toArray = (v: unknown): string[] => {
      if (Array.isArray(v)) return v;
      if (typeof v === 'string' && v.trim().length) {
        // support CSV like ?education=bac,Intermediate
        return v
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean);
      }
      return [];
    };

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

    // Salary range (overlap)
    if (salary) {
      const { min, max } = parseSalary(salary);
      if (min != null && max != null) {
        qb.andWhere(
          '(COALESCE(job.minSalary, 0) <= :smax AND COALESCE(job.maxSalary, job.minSalary) >= :smin)',
          { smin: min, smax: max },
        );
      } else if (min != null) {
        qb.andWhere('COALESCE(job.maxSalary, job.minSalary) >= :smin', {
          smin: min,
        });
      }
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
    if (sort === 'salary') {
      // ✅ sort by the selected alias to avoid TypeORM alias-parsing bug
      qb.orderBy('job_effSalary', 'DESC');
    } else if (sort === 'oldest') {
      qb.orderBy('job.createdAt', 'ASC');
    } else {
      qb.orderBy('job.createdAt', 'DESC'); // 'new' | 'latest'
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
      where: { slug, status: JobStatus.ACTIVE },
      relations: { employer: { profile: true } },
    });
    if (!job) throw new NotFoundException('Job not found');
    return job;
  }

  async findMine(employerId: number, page = 1, limit = 20) {
    const [data, total] = await this.repo.findAndCount({
      where: { employer: { id: employerId } },
      order: { createdAt: 'DESC' },
      take: limit,
      skip: (page - 1) * limit,
    });
    return { data, total, page, limit };
  }

  async update(id: number, employerId: number, dto: UpdateJobDto) {
    const job = await this.repo.findOne({
      where: { id, employer: { id: employerId } },
    });
    if (!job) throw new NotFoundException('Job not found or not yours');

    if (dto.title) job.slug = this.makeSlug(dto.title);
    Object.assign(job, dto);
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

    job.status = status;
    return this.repo.save(job);
  }
}
