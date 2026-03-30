import {
  BadRequestException,
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CandidateProfile } from './entities/candidate-profile.entity';
import { CandidateExperience } from './entities/candidate-experience.entity';
import { CandidateEducation } from './entities/candidate-education.entity';
import { CandidateResume } from './entities/candidate-resume.entity';
import { UpsertCandidateProfileDto } from './dto/upsert-candidate-profile.dto';
import { CreateExperienceDto } from './dto/create-experience.dto';
import { UpdateExperienceDto } from './dto/update-experience.dto';
import { CreateEducationDto } from './dto/create-education.dto';
import { UpdateEducationDto } from './dto/update-education.dto';
import { AddResumeDto } from './dto/add-resume.dto';
import { QueryCandidatesDto } from './dto/query-candidates.dto';
import { EntitlementsService } from 'src/subscriptions/entitlements.service';

@Injectable()
export class CandidateProfilesService {
  constructor(
    @InjectRepository(CandidateProfile)
    private profiles: Repository<CandidateProfile>,
    @InjectRepository(CandidateExperience)
    private exps: Repository<CandidateExperience>,
    @InjectRepository(CandidateEducation)
    private edus: Repository<CandidateEducation>,
    @InjectRepository(CandidateResume)
    private resumes: Repository<CandidateResume>,
    private readonly entitlements: EntitlementsService,
  ) {}

  async getMine(userId: number) {
    return this.profiles.findOne({
      where: { userId },
      relations: ['experiences', 'educations', 'resumes'],
      order: {
        experiences: { toYear: 'DESC', fromYear: 'DESC' },
        educations: { toYear: 'DESC', fromYear: 'DESC' },
        resumes: { uploadedAt: 'DESC' },
      },
    });
  }

  async upsertMine(userId: number, dto: UpsertCandidateProfileDto) {
    let p = await this.profiles.findOne({ where: { userId } });
    if (!p) {
      p = this.profiles.create({ userId, ...dto });
    } else {
      Object.assign(p, dto);
    }
    return this.profiles.save(p);
  }

  // Experiences
  async addExperience(userId: number, dto: CreateExperienceDto) {
    this.assertYearRange(dto.fromYear, dto.toYear);
    const exp = this.exps.create({ userId, ...dto });
    return this.exps.save(exp);
  }

  async updateExperience(userId: number, id: number, dto: UpdateExperienceDto) {
    const exp = await this.exps.findOne({ where: { id } });
    if (!exp || exp.userId !== userId) throw new NotFoundException();
    this.assertYearRange(
      dto.fromYear ?? exp.fromYear,
      dto.toYear !== undefined ? dto.toYear : exp.toYear,
    );
    Object.assign(exp, dto);
    return this.exps.save(exp);
  }

  async deleteExperience(userId: number, id: number) {
    const exp = await this.exps.findOne({ where: { id } });
    if (!exp || exp.userId !== userId) throw new NotFoundException();
    await this.exps.delete(id);
    return { ok: true };
  }

  // Educations
  async addEducation(userId: number, dto: CreateEducationDto) {
    this.assertYearRange(dto.fromYear, dto.toYear);
    const ed = this.edus.create({ userId, ...dto });
    return this.edus.save(ed);
  }

  async updateEducation(userId: number, id: number, dto: UpdateEducationDto) {
    const ed = await this.edus.findOne({ where: { id } });
    if (!ed || ed.userId !== userId) throw new NotFoundException();
    this.assertYearRange(
      dto.fromYear ?? ed.fromYear,
      dto.toYear !== undefined ? dto.toYear : ed.toYear,
    );
    Object.assign(ed, dto);
    return this.edus.save(ed);
  }

  async deleteEducation(userId: number, id: number) {
    const ed = await this.edus.findOne({ where: { id } });
    if (!ed || ed.userId !== userId) throw new NotFoundException();
    await this.edus.delete(id);
    return { ok: true };
  }

  // Resumes
  async addResume(userId: number, dto: AddResumeDto) {
    const current = await this.resumes.count({ where: { userId } });
    await this.entitlements.assertCandidateLimit(
      userId,
      'max_stored_cvs',
      current,
    );
    const r = this.resumes.create({ userId, ...dto });
    return this.resumes.save(r);
  }

  async deleteResume(userId: number, id: number) {
    const r = await this.resumes.findOne({ where: { id } });
    if (!r || r.userId !== userId) throw new NotFoundException();
    await this.resumes.delete(id);
    return { ok: true };
  }

  async listPublic(dto: QueryCandidatesDto) {
    const {
      page = 1,
      pageSize = 12,
      sort = 'latest',
      q,
      city,
      gender,
      nationality,
      onboardingCompleted,
      experienceMin,
      experienceMax,
      degreeMinLevel,
      degreeIncludes,
      experienceBuckets = [],
      educations = [],
    } = dto;

    const qb = this.profiles
      .createQueryBuilder('p')
      .select([
        'p.userId',
        'p.photoPath',
        'p.firstName',
        'p.lastName',
        'p.headline',
        'p.city',
        'p.createdAt',
        'p.updatedAt',
      ]);

    const yearsExpExpr = `
    (
      SELECT IFNULL(MAX(COALESCE(e.toYear, e.fromYear)) - MIN(e.fromYear) + 1, 0)
      FROM candidate_experiences e
      WHERE e.user_id = p.user_id
    )
  `;
    qb.addSelect(yearsExpExpr, 'yearsExp');

    const highestDegreeExpr = `
    (
      SELECT ed.degree
      FROM candidate_educations ed
      WHERE ed.user_id = p.user_id
      ORDER BY COALESCE(ed.toYear, ed.fromYear) DESC, ed.fromYear DESC, ed.id DESC
      LIMIT 1
    )
  `;
    qb.addSelect(highestDegreeExpr, 'highestDegree');

    const degreeRankExpr = `
    (
      SELECT IFNULL(MAX(
        CASE
          WHEN LOWER(ed.degree) REGEXP '(phd|doctorat|doctorate|dr\\.)' THEN 6
          WHEN LOWER(ed.degree) REGEXP '(master|mast[eè]re|m\\.sc|msc|m2|bac\\+5)' THEN 5
          WHEN LOWER(ed.degree) REGEXP '(licence|license|bachelor|bac\\+3|ba|bsc|b\\.sc)' THEN 4
          WHEN LOWER(ed.degree) REGEXP '(dut|bts|deug|iut|bac\\+2|graduation)' THEN 3
          WHEN LOWER(ed.degree) REGEXP '(bac|high school|lyc[ée]e|secondary|intermediate)' THEN 2
          WHEN LOWER(ed.degree) REGEXP '(college|prep|pr[ée]pa|technique)' THEN 1
          ELSE 0
        END
      ), 0)
      FROM candidate_educations ed
      WHERE ed.user_id = p.user_id
    )
  `;
    qb.addSelect(degreeRankExpr, 'degreeRank');

    if (q) {
      const terms = q.toLowerCase().split(/\s+/).filter(Boolean);
      terms.forEach((t, i) => {
        const key = `t${i}`;
        qb.andWhere(
          `(
          REPLACE(LOWER(p.firstName), '-', '') LIKE :${key}
          OR REPLACE(LOWER(p.lastName),  '-', '') LIKE :${key}
          OR REPLACE(LOWER(p.headline),  '-', '') LIKE :${key}
          OR REPLACE(LOWER(p.city),      '-', '') LIKE :${key}
        )`,
          { [key]: `%${t}%` },
        );
      });
    }

    if (city) qb.andWhere('p.city = :city', { city });
    if (gender) qb.andWhere('p.gender = :gender', { gender });
    if (nationality)
      qb.andWhere('p.nationality = :nationality', { nationality });

    if (typeof onboardingCompleted !== 'undefined') {
      qb.andWhere('p.onboardingCompleted = :oc', {
        oc: onboardingCompleted === '1',
      });
    }

    if (experienceBuckets.length) {
      const ranges: Array<{ min?: number; max?: number }> =
        experienceBuckets.map((bucket) => {
          switch (bucket) {
            case 'Freshers':
              return { min: 0, max: 0 };
            case '1 - 2 Years':
              return { min: 1, max: 2 };
            case '2 - 4 Years':
              return { min: 2, max: 4 };
            case '4 - 6 Years':
              return { min: 4, max: 6 };
            case '6 - 8 Years':
              return { min: 6, max: 8 };
            case '8 - 10 Years':
              return { min: 8, max: 10 };
            case '10 - 15 Years':
              return { min: 10, max: 15 };
            case '15+ Years':
              return { min: 15, max: undefined };
            default:
              return {};
          }
        });

      const validRanges = ranges.filter(
        (r) => typeof r.min === 'number' || typeof r.max === 'number',
      );

      if (validRanges.length) {
        const orParts: string[] = [];
        const params: Record<string, number> = {};

        validRanges.forEach((r, i) => {
          if (typeof r.min === 'number' && typeof r.max === 'number') {
            orParts.push(
              `(${yearsExpExpr} BETWEEN :expBucketMin${i} AND :expBucketMax${i})`,
            );
            params[`expBucketMin${i}`] = r.min;
            params[`expBucketMax${i}`] = r.max;
          } else if (typeof r.min === 'number') {
            orParts.push(`(${yearsExpExpr} >= :expBucketMin${i})`);
            params[`expBucketMin${i}`] = r.min;
          } else if (typeof r.max === 'number') {
            orParts.push(`(${yearsExpExpr} <= :expBucketMax${i})`);
            params[`expBucketMax${i}`] = r.max;
          }
        });

        if (orParts.length) {
          qb.andWhere(`(${orParts.join(' OR ')})`, params);
        }
      }
    } else {
      if (typeof experienceMin === 'number') {
        qb.andWhere(`${yearsExpExpr} >= :expMin`, { expMin: experienceMin });
      }
      if (typeof experienceMax === 'number') {
        qb.andWhere(`${yearsExpExpr} <= :expMax`, { expMax: experienceMax });
      }
    }

    if (typeof degreeMinLevel === 'number') {
      qb.andWhere(`${degreeRankExpr} >= :degMin`, { degMin: degreeMinLevel });
    }

    if (educations.length) {
      const eduTerms = educations
        .map((e) => String(e).trim().toLowerCase())
        .filter(Boolean);

      if (eduTerms.length) {
        const orParts: string[] = [];
        const params: Record<string, string> = {};

        eduTerms.forEach((term, i) => {
          orParts.push(`LOWER(ed2.degree) LIKE :eduLike${i}`);
          params[`eduLike${i}`] = `%${term}%`;
        });

        qb.andWhere(
          `EXISTS (
          SELECT 1
          FROM candidate_educations ed2
          WHERE ed2.user_id = p.user_id
            AND (${orParts.join(' OR ')})
        )`,
          params,
        );
      }
    } else if (degreeIncludes && degreeIncludes.trim()) {
      qb.andWhere(
        `EXISTS (
        SELECT 1 FROM candidate_educations ed2
        WHERE ed2.user_id = p.user_id
          AND LOWER(ed2.degree) LIKE :degLike
      )`,
        { degLike: `%${degreeIncludes.toLowerCase()}%` },
      );
    }

    if (sort === 'latest') qb.orderBy('p.updatedAt', 'DESC');
    else if (sort === 'oldest') qb.orderBy('p.updatedAt', 'ASC');
    else if (sort === 'name')
      qb.orderBy('p.lastName', 'ASC').addOrderBy('p.firstName', 'ASC');
    else if (sort === 'experience_desc')
      qb.orderBy('yearsExp', 'DESC').addOrderBy('p.updatedAt', 'DESC');
    else if (sort === 'experience_asc')
      qb.orderBy('yearsExp', 'ASC').addOrderBy('p.updatedAt', 'DESC');
    else if (sort === 'degree_desc')
      qb.orderBy('degreeRank', 'DESC').addOrderBy('p.updatedAt', 'DESC');
    else if (sort === 'degree_asc')
      qb.orderBy('degreeRank', 'ASC').addOrderBy('p.updatedAt', 'DESC');

    qb.skip((page - 1) * pageSize).take(pageSize);

    const { entities, raw } = await qb.getRawAndEntities();

    const items = entities.map((e, i) => ({
      userId: e.userId,
      photoPath: e.photoPath,
      firstName: e.firstName,
      lastName: e.lastName,
      headline: e.headline,
      city: e.city,
      createdAt: e.createdAt,
      updatedAt: e.updatedAt,
      years: raw[i]?.yearsExp != null ? Number(raw[i].yearsExp) : 0,
      highestDegree: raw[i]?.highestDegree ?? null,
    }));

    const total = await this.profiles
      .createQueryBuilder('p')
      .where(
        qb.getSql().match(/WHERE (.*?)( ORDER BY| LIMIT| OFFSET|$)/s)?.[1] ??
          '1=1',
      )
      .getCount()
      .catch(async () => {
        const countQb = this.profiles.createQueryBuilder('p');
        countQb.setParameters(qb.getParameters());
        return qb.getCount();
      });

    return {
      items,
      total,
      page: Number(page),
      pageSize: Number(pageSize),
      pageCount: Math.ceil(total / Number(pageSize)),
    };
  }

  async getPublicByUserIdForViewer(
    candidateUserId: number,
    viewer: { id: number; role: string },
  ) {
    const profile = await this.profiles.findOne({
      where: { userId: candidateUserId },
      relations: ['experiences', 'educations', 'resumes', 'user'],
      order: {
        experiences: { toYear: 'DESC', fromYear: 'DESC' },
        educations: { toYear: 'DESC', fromYear: 'DESC' },
        resumes: { uploadedAt: 'DESC' },
      },
    });

    if (!profile) throw new NotFoundException('Candidate profile not found');

    const role = String(viewer.role || '').toLowerCase();
    const isCandidateOwner =
      role === 'candidat' && Number(viewer.id) === Number(candidateUserId);

    if (isCandidateOwner || role === 'admin') {
      return profile;
    }

    if (role !== 'employer') {
      throw new ForbiddenException('Forbidden');
    }

    const entitlements = await this.entitlements.getEmployerEntitlements(
      Number(viewer.id),
    );
    const canAccessCv =
      entitlements.status === 'active' &&
      this.isCvWindowOpen(
        entitlements.startedAt,
        entitlements.limits.cv_access_days,
      );

    if (canAccessCv) {
      return profile;
    }

    return {
      ...profile,
      resumes: (profile.resumes ?? []).map((resume: any) => ({
        ...resume,
        filePath: null,
        url: null,
        locked: true,
      })),
    };
  }

  private isCvWindowOpen(
    startedAt: Date | null,
    cvAccessDays: number | null,
  ): boolean {
    if (!startedAt || cvAccessDays === null || cvAccessDays <= 0) {
      return false;
    }

    const cutoff = new Date(
      startedAt.getTime() + cvAccessDays * 24 * 60 * 60 * 1000,
    );
    return cutoff >= new Date();
  }

  private assertYearRange(fromYear: number, toYear?: number | null) {
    if (toYear != null && toYear < fromYear) {
      throw new BadRequestException(
        'toYear must be greater than or equal to fromYear',
      );
    }
  }
}
