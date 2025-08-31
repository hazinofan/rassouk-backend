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

@Injectable()
export class CandidateProfilesService {
  constructor(
    @InjectRepository(CandidateProfile) private profiles: Repository<CandidateProfile>,
    @InjectRepository(CandidateExperience) private exps: Repository<CandidateExperience>,
    @InjectRepository(CandidateEducation) private edus: Repository<CandidateEducation>,
    @InjectRepository(CandidateResume) private resumes: Repository<CandidateResume>,
  ) {}

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
}
