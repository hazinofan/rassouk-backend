// src/job-bookmarks/job-bookmark.service.ts
import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JobBookmark } from './entities/job-bookmark.entity';

@Injectable()
export class JobBookmarksService {
  constructor(
    @InjectRepository(JobBookmark)
    private readonly repo: Repository<JobBookmark>,
  ) {}

  private assertIds(userId: number, jobId: number) {
    if (!Number.isFinite(userId) || userId <= 0) {
      throw new BadRequestException('userId is required');
    }
    if (!Number.isFinite(jobId) || jobId <= 0) {
      throw new BadRequestException('jobId is required');
    }
  }

  async add(userId: number, jobId: number) {
    this.assertIds(userId, jobId);
    await this.repo
      .createQueryBuilder()
      .insert()
      .into(JobBookmark)
      .values({ userId, jobId })
      .orIgnore()
      .execute();
    return { ok: true };
  }

  async remove(userId: number, jobId: number) {
    this.assertIds(userId, jobId);
    await this.repo.delete({ userId, jobId });
    return { ok: true };
  }

  async isBookmarked(userId: number, jobId: number) {
    this.assertIds(userId, jobId);
    return this.repo.exists({ where: { userId, jobId } });
  }

  async listMine(userId: number) {
    if (!Number.isFinite(userId) || userId <= 0) {
      throw new BadRequestException('userId is required');
    }
    return this.repo.find({
      where: { userId },
      relations: {
        job: {
          employer: {
            profile: true,
          },
        },
      },
      select: ['jobId', 'createdAt'],
      order: { createdAt: 'DESC' },
    });
  }
}
