import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { MailService } from 'src/mail/mail.service';
import { Job } from 'src/jobs/entities/job.entity';
import { Repository } from 'typeorm';
import { AdminDeleteJobDto } from './dto/admin-delete-job.dto';
import { AdminJobQueryDto } from './dto/admin-job-query.dto';

@Injectable()
export class AdminJobsService {
  constructor(
    @InjectRepository(Job)
    private readonly jobsRepo: Repository<Job>,
    private readonly mail: MailService,
  ) {}

  async list(query: AdminJobQueryDto) {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(query.limit) || 20));
    const skip = (page - 1) * limit;

    const qb = this.jobsRepo
      .createQueryBuilder('job')
      .leftJoinAndSelect('job.employer', 'employer')
      .leftJoinAndSelect('employer.profile', 'profile')
      .withDeleted();

    if (query.q?.trim()) {
      const term = `%${query.q.trim()}%`;
      qb.andWhere('(job.title LIKE :term OR job.slug LIKE :term)', { term });
    }
    if (query.employerId) {
      qb.andWhere('employer.id = :employerId', { employerId: query.employerId });
    }
    if (query.status) {
      qb.andWhere('job.status = :status', { status: query.status });
    }
    qb.orderBy(`job.${query.sortBy ?? 'createdAt'}`, query.sortDir ?? 'DESC');
    qb.skip(skip).take(limit);
    const [data, total] = await qb.getManyAndCount();

    return { data, total, page, limit };
  }

  async getOne(id: number) {
    const job = await this.jobsRepo.findOne({
      where: { id },
      relations: { employer: { profile: true } },
      withDeleted: true,
    });
    if (!job) throw new NotFoundException('Job not found');
    return job;
  }

  async delete(id: number, dto: AdminDeleteJobDto) {
    const job = await this.jobsRepo.findOne({
      where: { id },
      withDeleted: true,
      relations: ['employer'],
    });
    if (!job) throw new NotFoundException('Job not found');

    await this.jobsRepo.softDelete(id);

    if (job.employer?.email) {
      await this.mail.sendJobDeletedByAdmin({
        to: job.employer.email,
        employerName: job.employer.name,
        jobTitle: job.title,
        reason: dto.reason.trim(),
      });
    }

    return { ok: true };
  }
}
