import { ForbiddenException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Cron } from '@nestjs/schedule';
import { Repository } from 'typeorm';
import {
  Notification,
  NotificationType,
} from './entities/notification.entity';
import { Job, JobStatus } from 'src/jobs/entities/job.entity';

type CreateNotificationInput = {
  userId: number;
  type?: NotificationType;
  title: string;
  message: string;
  payload?: Record<string, unknown>;
  uniqueKey?: string;
};

@Injectable()
export class NotificationsService {
  constructor(
    @InjectRepository(Notification)
    private readonly repo: Repository<Notification>,
    @InjectRepository(Job)
    private readonly jobRepo: Repository<Job>,
  ) {}

  create(input: CreateNotificationInput) {
    const item = this.repo.create({
      userId: input.userId,
      type: input.type ?? NotificationType.SYSTEM,
      title: input.title,
      message: input.message,
      payload: input.payload ?? null,
      uniqueKey: input.uniqueKey ?? null,
    });
    return this.repo.save(item);
  }

  async createOnce(input: CreateNotificationInput & { uniqueKey: string }) {
    const exists = await this.repo.exists({
      where: { uniqueKey: input.uniqueKey },
    });
    if (exists) {
      return null;
    }
    return this.create(input);
  }

  async listForUser(userId: number, page = 1, limit = 20) {
    const safePage = Math.max(1, Number(page) || 1);
    const safeLimit = Math.min(100, Math.max(1, Number(limit) || 20));
    const [data, total] = await this.repo.findAndCount({
      where: { userId },
      order: { createdAt: 'DESC' },
      take: safeLimit,
      skip: (safePage - 1) * safeLimit,
    });

    return {
      data,
      total,
      page: safePage,
      limit: safeLimit,
      pageCount: Math.ceil(total / safeLimit),
    };
  }

  unreadCount(userId: number) {
    return this.repo.count({
      where: { userId, isRead: false },
    });
  }

  async markOneAsRead(userId: number, notificationId: number) {
    const notification = await this.repo.findOneBy({ id: notificationId });
    if (!notification || notification.userId !== userId) {
      throw new ForbiddenException('Notification not found');
    }

    if (notification.isRead) {
      return notification;
    }

    notification.isRead = true;
    notification.readAt = new Date();
    return this.repo.save(notification);
  }

  async markAllAsRead(userId: number) {
    await this.repo
      .createQueryBuilder()
      .update(Notification)
      .set({ isRead: true, readAt: () => 'CURRENT_TIMESTAMP' })
      .where('userId = :userId', { userId })
      .andWhere('isRead = :isRead', { isRead: false })
      .execute();

    return { success: true };
  }

  // Every day at 09:00, notify employers about jobs that need attention.
  @Cron('0 9 * * *')
  async emitEmployerJobHealthNotifications() {
    await Promise.all([
      this.notifyJobsExpiringInThreeDays(),
      this.notifyExpiredJobs(),
      this.notifyNoApplicationsAfterThreeDays(),
    ]);
  }

  private async notifyJobsExpiringInThreeDays() {
    const jobs = await this.jobRepo
      .createQueryBuilder('job')
      .leftJoinAndSelect('job.employer', 'employer')
      .where('job.status = :status', { status: JobStatus.ACTIVE })
      .andWhere('job.expiresAt IS NOT NULL')
      .andWhere('DATE(job.expiresAt) = DATE(DATE_ADD(NOW(), INTERVAL 3 DAY))')
      .getMany();

    for (const job of jobs) {
      await this.createOnce({
        userId: job.employer?.id,
        type: NotificationType.JOB_EXPIRING_SOON,
        title: 'Job expiring in 3 days',
        message: `"${job.title}" will expire in 3 days. Consider refreshing it to keep it visible.`,
        payload: { jobId: job.id, jobSlug: job.slug, expiresAt: job.expiresAt },
        uniqueKey: `JOB_EXPIRING_SOON:${job.id}:${this.toYmd(job.expiresAt)}`,
      });
    }
  }

  private async notifyExpiredJobs() {
    const jobs = await this.jobRepo
      .createQueryBuilder('job')
      .leftJoinAndSelect('job.employer', 'employer')
      .where('job.expiresAt IS NOT NULL')
      .andWhere('job.expiresAt < NOW()')
      .andWhere('job.status IN (:...statuses)', {
        statuses: [JobStatus.ACTIVE, JobStatus.EXPIRED],
      })
      .andWhere('job.expiresAt >= DATE_SUB(NOW(), INTERVAL 30 DAY)')
      .getMany();

    for (const job of jobs) {
      await this.createOnce({
        userId: job.employer?.id,
        type: NotificationType.JOB_EXPIRED,
        title: 'Job expired',
        message: `"${job.title}" has expired.`,
        payload: { jobId: job.id, jobSlug: job.slug, expiresAt: job.expiresAt },
        uniqueKey: `JOB_EXPIRED:${job.id}`,
      });
    }
  }

  private async notifyNoApplicationsAfterThreeDays() {
    const jobs = await this.jobRepo
      .createQueryBuilder('job')
      .leftJoinAndSelect('job.employer', 'employer')
      .leftJoin('job.applications', 'app')
      .where('job.status = :status', { status: JobStatus.ACTIVE })
      .andWhere('job.createdAt <= DATE_SUB(NOW(), INTERVAL 3 DAY)')
      .groupBy('job.id')
      .addGroupBy('employer.id')
      .having('COUNT(app.id) = 0')
      .getMany();

    for (const job of jobs) {
      await this.createOnce({
        userId: job.employer?.id,
        type: NotificationType.JOB_NO_APPLICATIONS_3_DAYS,
        title: 'No applications after 3 days',
        message: `"${job.title}" has received 0 applications in 3 days. Try posting it again.`,
        payload: { jobId: job.id, jobSlug: job.slug, daysWithoutApplications: 3 },
        uniqueKey: `JOB_NO_APPLICATIONS_3_DAYS:${job.id}`,
      });
    }
  }

  private toYmd(value?: Date | null) {
    if (!value) return 'unknown';
    return new Date(value).toISOString().slice(0, 10);
  }
}
