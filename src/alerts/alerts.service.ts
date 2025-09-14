// src/alerts/alerts.service.ts
import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Brackets } from 'typeorm';
import { Cron } from '@nestjs/schedule';

import { CandidateProfile } from 'src/candidate-profile/entities/candidate-profile.entity';
import { Job } from 'src/jobs/entities/job.entity';

import { MailService } from 'src/mail/mail.service';
import { JobAlert } from './entities/alert.entity';
import { JobAlertDigestItem } from './entities/job-alert-digest-item.entity';
import { CreateJobAlertDto } from './dto/create-alert.dto';
import { UpdateJobAlertDto } from './dto/update-alert.dto';

@Injectable()
export class JobAlertsService {
  private readonly logger = new Logger(JobAlertsService.name);

  constructor(
    @InjectRepository(JobAlert) private alerts: Repository<JobAlert>,
    @InjectRepository(JobAlertDigestItem)
    private digests: Repository<JobAlertDigestItem>,
    @InjectRepository(CandidateProfile)
    private profiles: Repository<CandidateProfile>,
    @InjectRepository(Job) private jobs: Repository<Job>,
    private mail: MailService,
  ) {}

  /* -------------------------------------------------------------------------- */
  /*                                   CREATE                                   */
  /* -------------------------------------------------------------------------- */
  async createForCandidate(candidateId: number, dto: CreateJobAlertDto) {
    const profile = await this.profiles.findOneByOrFail({
      userId: candidateId,
    });
    const alert = this.alerts.create({
      ...dto,
      candidate: profile,
      is_active: dto.is_active ?? true,
    });
    return this.alerts.save(alert);
  }

  /* -------------------------------------------------------------------------- */
  /*                                   READ                                     */
  /* -------------------------------------------------------------------------- */
  findByCandidate(candidateId: number) {
    return this.alerts.find({
      where: { candidate: { userId: candidateId } },
      relations: { candidate: true },
      order: { created_at: 'DESC' },
    });
  }

  async findOneForCandidate(id: number, candidateId: number) {
    const alert = await this.alerts.findOne({
      where: { id, candidate: { userId: candidateId } },
      relations: { candidate: true },
    });
    if (!alert) throw new NotFoundException('Alert not found');
    return alert;
  }

  /* -------------------------------------------------------------------------- */
  /*                                   UPDATE                                   */
  /* -------------------------------------------------------------------------- */
  async updateForCandidate(
    id: number,
    candidateId: number,
    dto: UpdateJobAlertDto,
  ) {
    const alert = await this.findOneForCandidate(id, candidateId);
    Object.assign(alert, dto);
    return this.alerts.save(alert);
  }

  /* -------------------------------------------------------------------------- */
  /*                                   DELETE                                   */
  /* -------------------------------------------------------------------------- */
  async removeForCandidate(id: number, candidateId: number) {
    const alert = await this.findOneForCandidate(id, candidateId);
    await this.alerts.delete(alert.id);
    return { ok: true };
  }

  /* -------------------------------------------------------------------------- */
  /*                              WEEKLY PREVIEW                                */
  /* -------------------------------------------------------------------------- */
  // replace previewWeekly
  async previewWeekly(id: number, candidateId: number) {
    const alert = await this.findOneForCandidate(id, candidateId);

    // last 7 days window for preview
    const to = new Date();
    const from = new Date(to);
    from.setDate(to.getDate() - 7);

    const weekOf = this.ymd(from);
    const jobs = await this.findTop5(
      alert,
      from,
      to,
      weekOf,
      /*useDateFilter=*/ true,
    );
    return { weekOf, count: jobs.length, jobs };
  }

  /* -------------------------------------------------------------------------- */
  /*                                  CRON JOB                                  */
  /* -------------------------------------------------------------------------- */
  @Cron('0 8 * * 0') // every Sunday 08:00
  async sendWeeklyDigests() {
    this.logger.log('Sending weekly job alert digests...');

    const { start, end } = this.weekWindow();
    const weekOf = this.ymd(start);

    const activeAlerts = await this.alerts.find({
      where: { is_active: true, send_day: 'sunday' },
      relations: { candidate: { user: true } },
    });

    for (const alert of activeAlerts) {
      try {
        const jobs = await this.findTop5(alert, start, end, weekOf);
        if (!jobs.length) continue;

        // Send mail
        await this.mail.sendJobDigest({
          to: alert.candidate.user?.email ?? alert.candidate.contactEmail,
          candidateName: `${alert.candidate.firstName} ${alert.candidate.lastName}`,
          weekOf,
          jobs,
          manageUrl: `${process.env.APP_URL}/dashboard/alerts`,
        });

        // Record items
        await Promise.all(
          jobs.map((j) =>
            this.digests.insert({
              alert_id: alert.id,
              job_id: j.id,
              week_of: weekOf,
            }),
          ),
        );

        await this.alerts.update(alert.id, { last_sent_at: new Date() });
      } catch (e) {
        this.logger.error(`Digest failed for alert ${alert.id}: ${e.message}`);
      }
    }
  }

  /* -------------------------------------------------------------------------- */
  /*                               HELPER METHODS                               */
  /* -------------------------------------------------------------------------- */
  private weekWindow(ref = new Date()) {
    const d = new Date(ref);
    const dow = d.getDay(); // 0 = Sunday
    const end = new Date(d);
    end.setDate(d.getDate() - dow);
    end.setHours(23, 59, 59, 999);

    const start = new Date(end);
    start.setDate(end.getDate() - 6);
    start.setHours(0, 0, 0, 0);

    return { start, end };
  }

  private ymd(date: Date) {
    return date.toISOString().slice(0, 10);
  }

private qbForAlert(alert: JobAlert, from?: Date, to?: Date) {
  const qb = this.jobs.createQueryBuilder('job');

  if (from && to) {
    qb.andWhere('job.createdAt BETWEEN :from AND :to', { from, to });
  }

  const orBlocks: Brackets[] = [];

  // ---- KEYWORD bigrams (e.g., "full stack" OR "stack developer")
  const raw = (alert.keyword ?? '').trim().replace(/\s+/g, ' ');
  if (raw) {
    const words = raw.split(' ').filter(Boolean);
    if (words.length >= 2) {
      orBlocks.push(
        new Brackets((b) => {
          for (let i = 0; i < words.length - 1; i++) {
            const w1 = words[i];
            const w2 = words[i + 1];
            const pBg = `bg${i}`;
            const pW1 = `tg${i}a`;
            const pW2 = `tg${i}b`;

            b.orWhere(
              new Brackets((bb) => {
                // title contains the two-word phrase, OR tags contain both words
                bb.where(`job.title LIKE :${pBg}`, { [pBg]: `%${w1} ${w2}%` })
                  .orWhere(
                    new Brackets((tt) => {
                      tt.where(`job.tags LIKE :${pW1}`, { [pW1]: `%${w1}%` })
                        .andWhere(`job.tags LIKE :${pW2}`, { [pW2]: `%${w2}%` });
                    }),
                  );
              }),
            );
          }
        }),
      );
    } else {
      // single word fallback
      orBlocks.push(
        new Brackets((b) => {
          b.where(`job.title LIKE :one`, { one: `%${words[0]}%` })
            .orWhere(`job.tags LIKE :one`, { one: `%${words[0]}%` });
        }),
      );
    }
  }

  // ---- JOB TYPE
  if (alert.job_type) {
    orBlocks.push(new Brackets((b) => b.where('job.jobType = :jt', { jt: alert.job_type })));
    // If using SnakeNamingStrategy -> 'job.job_type'
  }

  // ---- TAGS (any match)
  if (alert.tags?.length) {
    const tags = alert.tags
      .map((t) => t?.trim())
      .filter(Boolean);

    if (tags.length) {
      orBlocks.push(
        new Brackets((b) => {
          tags.forEach((t, i) => {
            const p = `tag${i}`;
            // exact token match with FIND_IN_SET + permissive LIKE as a fallback
            b.orWhere(`FIND_IN_SET(:${p}, job.tags)`, { [p]: t })
             .orWhere(`job.tags LIKE :${p}like`, { [`${p}like`]: `%${t}%` });
          });
        }),
      );
    }
  }

  // Apply OR across all provided criteria (if any)
  if (orBlocks.length) {
    qb.andWhere(
      new Brackets((outer) => {
        orBlocks.forEach((blk, idx) => (idx === 0 ? outer.where(blk) : outer.orWhere(blk)));
      }),
    );
  }

  return qb;
}


  private async findTop5(
    alert: JobAlert,
    from: Date | undefined,
    to: Date | undefined,
    weekOf: string,
    useDateFilter = true,
  ) {
    return this.qbForAlert(
      alert,
      useDateFilter ? from : undefined,
      useDateFilter ? to : undefined,
    )
      .andWhere(
        `NOT EXISTS (
        SELECT 1 FROM job_alert_digest_items d
        WHERE d.job_id = job.id
          AND d.alert_id = :aid
          AND d.week_of = :week
      )`,
        { aid: alert.id, week: weekOf },
      )
      .orderBy('job.createdAt', 'DESC')
      .limit(5)
      .getMany();
  }
}
