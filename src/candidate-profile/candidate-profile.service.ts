import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
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

@Injectable()
export class CandidateProfilesService {
  constructor(
    @InjectRepository(CandidateProfile) private profiles: Repository<CandidateProfile>,
    @InjectRepository(CandidateExperience) private exps: Repository<CandidateExperience>,
    @InjectRepository(CandidateEducation) private edus: Repository<CandidateEducation>,
    @InjectRepository(CandidateResume) private resumes: Repository<CandidateResume>,
  ) { }

  async getMine(userId: number) {
    return this.profiles.findOne({
      where: { userId },
      relations: ['experiences', 'educations', 'resumes'],
      order: {
        experiences: { year: 'DESC' },
        educations: { year: 'DESC' },
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
    const exp = this.exps.create({ userId, ...dto });
    return this.exps.save(exp);
  }

  async updateExperience(userId: number, id: number, dto: UpdateExperienceDto) {
    const exp = await this.exps.findOne({ where: { id } });
    if (!exp || exp.userId !== userId) throw new NotFoundException();
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
    const ed = this.edus.create({ userId, ...dto });
    return this.edus.save(ed);
  }

  async updateEducation(userId: number, id: number, dto: UpdateEducationDto) {
    const ed = await this.edus.findOne({ where: { id } });
    if (!ed || ed.userId !== userId) throw new NotFoundException();
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
    } = dto;

    const qb = this.profiles.createQueryBuilder('p')
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

    // yearsExp: span using your `candidate_experiences.year`
    const yearsExpExpr = `
    (
      SELECT IFNULL(MAX(e.year) - MIN(e.year) + 1, 0)
      FROM candidate_experiences e
      WHERE e.user_id = p.user_id
    )
  `;
    qb.addSelect(yearsExpExpr, 'yearsExp');

    // highestDegree: keep your original string (best single entry)
    const highestDegreeExpr = `
    (
      SELECT ed.degree
      FROM candidate_educations ed
      WHERE ed.user_id = p.user_id
      ORDER BY ed.year DESC, ed.id DESC
      LIMIT 1
    )
  `;
    qb.addSelect(highestDegreeExpr, 'highestDegree');

    // degreeRank: robust normalization (FR/EN + common abbreviations)
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

    // ---------- Filters ----------
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
    if (nationality) qb.andWhere('p.nationality = :nationality', { nationality });
    if (typeof onboardingCompleted !== 'undefined') {
      qb.andWhere('p.onboardingCompleted = :oc', { oc: onboardingCompleted === '1' });
    }

    // Experience range
    if (typeof experienceMin === 'number') qb.andWhere(`${yearsExpExpr} >= :expMin`, { expMin: experienceMin });
    if (typeof experienceMax === 'number') qb.andWhere(`${yearsExpExpr} <= :expMax`, { expMax: experienceMax });

    // Degree minimum level (0..6)
    if (typeof degreeMinLevel === 'number') qb.andWhere(`${degreeRankExpr} >= :degMin`, { degMin: degreeMinLevel });

    // Degree fuzzy text contains
    if (degreeIncludes && degreeIncludes.trim()) {
      qb.andWhere(`EXISTS (
      SELECT 1 FROM candidate_educations ed2
      WHERE ed2.user_id = p.user_id
        AND LOWER(ed2.degree) LIKE :degLike
    )`, { degLike: `%${degreeIncludes.toLowerCase()}%` });
    }

    // ---------- Sorting ----------
    if (sort === 'latest') qb.orderBy('p.updatedAt', 'DESC');
    else if (sort === 'oldest') qb.orderBy('p.updatedAt', 'ASC');
    else if (sort === 'name') qb.orderBy('p.lastName', 'ASC').addOrderBy('p.firstName', 'ASC');
    else if (sort === 'experience_desc') qb.orderBy('yearsExp', 'DESC').addOrderBy('p.updatedAt', 'DESC');
    else if (sort === 'experience_asc') qb.orderBy('yearsExp', 'ASC').addOrderBy('p.updatedAt', 'DESC');
    else if (sort === 'degree_desc') qb.orderBy('degreeRank', 'DESC').addOrderBy('p.updatedAt', 'DESC');
    else if (sort === 'degree_asc') qb.orderBy('degreeRank', 'ASC').addOrderBy('p.updatedAt', 'DESC');

    // ---------- Pagination ----------
    qb.skip((page - 1) * pageSize).take(pageSize);

    const { entities, raw } = await qb.getRawAndEntities();

    // project response
    const items = entities.map((e, i) => ({
      userId: e.userId,
      photoPath: e.photoPath,
      firstName: e.firstName,
      lastName: e.lastName,
      headline: e.headline,
      city: e.city,
      createdAt: e.createdAt,
      updatedAt: e.updatedAt,
      yearsExp: raw[i]?.yearsExp != null ? Number(raw[i].yearsExp) : 0,
      highestDegree: raw[i]?.highestDegree ?? null,
      // degreeRank is internal (used for filter/sort); don’t expose unless you want to:
      // degreeRank: raw[i]?.degreeRank != null ? Number(raw[i].degreeRank) : 0,
    }));

    // TypeORM getCount() on same WHEREs (clone without skip/take for correctness if needed)
    const total = await this.profiles.createQueryBuilder('p')
      .where(qb.getSql().match(/WHERE (.*?)( ORDER BY| LIMIT| OFFSET|$)/s)?.[1] ?? '1=1') // fallback
      .getCount()
      .catch(async () => {
        // Safe fallback: run count with same WHEREs via cloned QB (TypeORM v<=0.3.x quirks)
        const countQb = this.profiles.createQueryBuilder('p');
        countQb.setParameters(qb.getParameters());
        // Reapply filters (duplicate minimal code if needed); or simpler:
        // use qb.clone() if your TypeORM version supports it cleanly for count
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
}
