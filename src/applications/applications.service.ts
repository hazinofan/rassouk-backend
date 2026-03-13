import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Application, ApplicationStatus } from './entities/application.entity';
import { Job, JobStatus } from 'src/jobs/entities/job.entity';
import { CandidateProfile } from 'src/candidate-profile/entities/candidate-profile.entity';
import { CreateApplicationDto } from './dto/create-application.dto';
import { MailService } from 'src/mail/mail.service';
import { QueryApplicationsDto } from './dto/query-applications.dto';
import { EntitlementsService } from 'src/subscriptions/entitlements.service';
import { NotificationsService } from 'src/notifications/notifications.service';
import { NotificationType } from 'src/notifications/entities/notification.entity';

@Injectable()
export class ApplicationsService {
  constructor(
    @InjectRepository(Application) private appRepo: Repository<Application>,
    @InjectRepository(Job) private jobRepo: Repository<Job>,
    @InjectRepository(CandidateProfile)
    private profRepo: Repository<CandidateProfile>,
    private mail: MailService,
    private readonly entitlements: EntitlementsService,
    private readonly notifications: NotificationsService,
  ) {}

  async create(jobId: number, candidateId: number, dto: CreateApplicationDto) {
    const currentMonthApplications = await this.appRepo.count({
      where: {
        candidate: { id: candidateId },
        createdAt: this.entitlements.getMonthBetweenClause(),
      },
    });
    await this.entitlements.assertCandidateLimit(
      candidateId,
      'max_applications_per_month',
      currentMonthApplications,
    );

    const job = await this.jobRepo.findOne({
      where: { id: jobId },
      relations: ['employer', 'employer.profile'],
    });
    if (!job) throw new NotFoundException('Job not found');
    if (job.status !== JobStatus.ACTIVE)
      throw new BadRequestException('Job not active');
    if (job.expiresAt && job.expiresAt < new Date())
      throw new BadRequestException('Job expired');

    // Duplicate check
    const already = await this.appRepo.exists({
      where: { job: { id: jobId }, candidate: { id: candidateId } },
    });
    if (already) throw new BadRequestException('Already applied');

    // Load candidate profile (with resumes + user)
    const profile = await this.profRepo.findOne({
      where: { userId: candidateId },
      relations: ['resumes', 'user'],
    });
    if (!profile || !profile.resumes?.length) {
      throw new BadRequestException(
        'No resume in profile. Please upload one first.',
      );
    }

    const employerId = job.employer?.id ?? null;

    const primary =
      profile.resumes.find((r: any) => r.isPrimary) ??
      profile.resumes
        .slice()
        .sort(
          (a: any, b: any) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
        )[0];

    const resumeUrl = (primary as any).filePath || (primary as any).url;
    if (!resumeUrl) {
      throw new BadRequestException('Resume file missing a URL/path.');
    }

    const app = this.appRepo.create({
      job: { id: jobId } as any,
      candidate: { id: candidateId } as any,
      employerId,
      resumeUrl,
      coverLetter: dto.coverLetter?.trim() || undefined,
      status: ApplicationStatus.SUBMITTED,
      source: dto.source || 'JOB_PAGE',
    });

    const saved = await this.appRepo.save(app);

    // ✅ Send confirmation email
    const candidateEmail = profile.user?.email;
    if (candidateEmail) {
      await this.mail.sendApplicationConfirmation(
        candidateEmail,
        job.title,
        job.employer?.profile?.companyName,
      );
    }

    if (employerId) {
      await this.notifications.create({
        userId: employerId,
        type: NotificationType.NEW_APPLICATION,
        title: 'New application received',
        message: `${profile.user?.name ?? 'A candidate'} applied to "${job.title}"`,
        payload: {
          applicationId: saved.id,
          jobId: job.id,
          jobSlug: job.slug,
          candidateId,
        },
      });
    }

    return saved;
  }

  async getAppById(id: number, requester: { id: number; role: string }) {
    const app = await this.appRepo.findOne({
      where: { id },
      relations: {
        candidate: {
          candidateProfile: {
            resumes: true,
            experiences: true,
            educations: true,
          },
        },
        job: {
          employer: true,
        },
      },
    });

    if (!app) throw new NotFoundException('Application not found');

    const isCandidateOwner = app.candidate?.id === requester.id;
    const isEmployerOwner = app.employerId === requester.id;
    if (!isCandidateOwner && !isEmployerOwner) {
      throw new ForbiddenException('You do not own this application');
    }

    return isEmployerOwner ? this.maskApplicationCvIfNeeded(app) : app;
  }

  async updateStatusForEmployer(
    appId: number,
    employerId: number,
    next: ApplicationStatus,
    details?: {
      employerNote?: string;
      rejectionReason?: string;
      interviewAt?: string;
    },
  ) {
    const app = await this.appRepo.findOne({
      where: { id: appId },
      relations: ['candidate', 'job'],
    });
    if (!app) throw new NotFoundException('Application not found');
    if (app.employerId !== employerId)
      throw new ForbiddenException('You do not own this application');
    if (
      app.status === next &&
      !details?.employerNote &&
      !details?.rejectionReason &&
      !details?.interviewAt
    ) {
      return { id: app.id, status: app.status };
    }

    const order: Record<ApplicationStatus, number> = {
      SUBMITTED: 1,
      VIEWED: 2,
      SHORTLISTED: 3,
      INTERVIEW: 4,
      OFFERED: 5,
      REJECTED: 6,
      WITHDRAWN: 7,
    } as const;

    // allow only SHORTLISTED -> VIEWED as a permitted "downgrade"
    const allowDowngrade = new Set<string>(['SHORTLISTED->VIEWED','REJECTED->VIEWED']);

    const cur = order[app.status as ApplicationStatus] ?? 0;
    const nxt = order[next] ?? 0;
    const pair = `${app.status}->${next}`;

    if (nxt < cur && !allowDowngrade.has(pair)) {
      return { id: app.id, status: app.status }; // ignore other downgrades
    }

    await this.applyEmployerStatusTransition(app, next, details);
    await this.appRepo.save(app);

    if (app.candidate?.id) {
      await this.notifications.create({
        userId: app.candidate.id,
        type: NotificationType.APPLICATION_STATUS_CHANGED,
        title: 'Application update',
        message: `Your application for "${app.job?.title ?? 'a job'}" is now ${next.toLowerCase()}.`,
        payload: {
          applicationId: app.id,
          jobId: app.job?.id,
          jobSlug: (app.job as any)?.slug,
          status: next,
        },
      });
    }

    return { id: app.id, status: app.status };
  }

  async bulkUpdateStatusForEmployer(
    employerId: number,
    appIds: number[],
    next: ApplicationStatus,
    details?: {
      employerNote?: string;
      rejectionReason?: string;
      interviewAt?: string;
    },
  ) {
    await this.entitlements.assertEmployerFeature(
      employerId,
      'bulk_application_actions_enabled',
    );
    const allowedStatuses = new Set<ApplicationStatus>([
      ApplicationStatus.VIEWED,
      ApplicationStatus.SHORTLISTED,
      ApplicationStatus.REJECTED,
    ]);
    if (!allowedStatuses.has(next)) {
      throw new BadRequestException(
        'Bulk update only supports VIEWED, SHORTLISTED, and REJECTED statuses',
      );
    }

    const ids = Array.from(new Set(appIds.map((id) => Number(id)).filter(Boolean)));
    if (!ids.length) {
      return { updatedCount: 0, updatedIds: [], skippedIds: [] };
    }

    const apps = await this.appRepo.find({
      where: {
        id: In(ids),
        employerId,
      },
      relations: ['candidate', 'job'],
    });

    const byId = new Map(apps.map((app) => [app.id, app]));
    const updatedIds: number[] = [];
    const skippedIds: number[] = [];

    for (const id of ids) {
      const app = byId.get(id);
      if (!app) {
        skippedIds.push(id);
        continue;
      }

      if (app.status === next) {
        skippedIds.push(id);
        continue;
      }

      await this.applyEmployerStatusTransition(app, next, details);
      updatedIds.push(id);
    }

    if (apps.length) {
      await this.appRepo.save(apps);
    }

    await Promise.all(
      apps
        .filter((app) => updatedIds.includes(app.id) && app.candidate?.id)
        .map((app) =>
          this.notifications.create({
            userId: app.candidate.id,
            type: NotificationType.APPLICATION_STATUS_CHANGED,
            title: 'Application update',
            message: `Your application for "${app.job?.title ?? 'a job'}" is now ${next.toLowerCase()}.`,
            payload: {
              applicationId: app.id,
              jobId: app.job?.id,
              jobSlug: (app.job as any)?.slug,
              status: next,
            },
          }),
        ),
    );

    return {
      updatedCount: updatedIds.length,
      updatedIds,
      skippedIds,
    };
  }

  async getApplicationsForJob(jobId: number, employerId: number) {
    const job = await this.jobRepo.findOne({
      where: { id: jobId, employer: { id: employerId } },
      relations: ['applications', 'applications.candidate'],
    });

    if (!job) throw new NotFoundException('Job not found or not owned by you');

    return Promise.all(
      job.applications.map((app) => this.maskApplicationCvIfNeeded(app)),
    );
  }

  myApps(candidateId: number) {
    return this.appRepo.find({
      where: { candidate: { id: candidateId } },
      relations: {
        job: {
          employer: {
            profile: true,
          },
        },
      },
      order: { createdAt: 'DESC' },
    });
  }

  async hasApplied(jobId: number, candidateId: number) {
    return this.appRepo.exists({
      where: { job: { id: jobId }, candidate: { id: candidateId } },
    });
  }

  async listByJobSlugForEmployer(
    slug: string,
    employerId: number,
    qs: QueryApplicationsDto,
  ) {
    // 1) ownership check
    const job = await this.jobRepo.findOne({
      where: { slug, employer: { id: employerId } },
      select: { id: true } as any,
      relations: { employer: true },
    });
    if (!job) throw new NotFoundException('Job not found or not yours');

    // 2) pagination
    const page = Math.max(1, Number(qs.page || 1));
    const limit = Math.min(100, Number(qs.limit || 20));
    const skip = (page - 1) * limit;

    // 3) query: candidate + candidate.candidateProfile (1:1 only)
    const qb = this.appRepo
      .createQueryBuilder('app')
      .innerJoin('app.job', 'job')
      .leftJoinAndSelect('app.candidate', 'candidate')
      .leftJoinAndSelect('candidate.candidateProfile', 'candidateProfile') // << here
      .where('job.id = :jobId', { jobId: job.id })
      .orderBy('app.createdAt', 'DESC')
      .take(limit)
      .skip(skip);

    // free text filter on candidate + profile fields
    if (qs.q && qs.q.trim()) {
      const q = `%${qs.q.trim().toLowerCase()}%`;
      qb.andWhere(
        `
      (LOWER(candidate.name) LIKE :q
        OR LOWER(candidate.email) LIKE :q
        OR LOWER(candidateProfile.headline) LIKE :q
        OR LOWER(candidateProfile.city) LIKE :q)
      `,
        { q },
      );
    }

    if (qs.status?.length) {
      qb.andWhere('app.status IN (:...status)', { status: qs.status });
    }

    if (qs.appliedFrom) {
      qb.andWhere('app.createdAt >= :appliedFrom', {
        appliedFrom: new Date(qs.appliedFrom),
      });
    }

    if (qs.appliedTo) {
      qb.andWhere('app.createdAt <= :appliedTo', {
        appliedTo: new Date(qs.appliedTo),
      });
    }

    const [data, total] = await qb.getManyAndCount();
    const masked = await Promise.all(
      data.map((app) => this.maskApplicationCvIfNeeded(app)),
    );
    return { data: masked, total, page, limit };
  }

  private async maskApplicationCvIfNeeded(app: Application) {
    const entitlements = await this.entitlements.getEmployerEntitlements(
      Number(app.employerId),
    );
    const canAccessCv =
      entitlements.status === 'active' &&
      this.isCvWindowOpen(
        entitlements.startedAt,
        entitlements.limits.cv_access_days,
      );

    if (canAccessCv) {
      return app;
    }

    return {
      ...app,
      resumeUrl: null,
      cvLocked: true,
      candidate: app.candidate
        ? {
            ...app.candidate,
            candidateProfile: app.candidate.candidateProfile
              ? {
                  ...app.candidate.candidateProfile,
                  resumes: (app.candidate.candidateProfile.resumes ?? []).map(
                    (resume: any) => ({
                      ...resume,
                      filePath: null,
                      url: null,
                      locked: true,
                    }),
                  ),
                }
              : app.candidate.candidateProfile,
          }
        : app.candidate,
    };
  }

  private isCvWindowOpen(
    startedAt: Date | null,
    cvAccessDays: number | null,
  ) {
    if (!startedAt || cvAccessDays === null || cvAccessDays <= 0) {
      return false;
    }

    const cutoff = new Date(
      startedAt.getTime() + cvAccessDays * 24 * 60 * 60 * 1000,
    );
    return cutoff >= new Date();
  }

  async sendInterviewInvitation(
    appId: number,
    employerId: number,
    interviewAt: string,
    message?: string,
  ) {
    await this.entitlements.assertEmployerFeature(
      employerId,
      'candidate_contact_enabled',
    );
    await this.entitlements.assertEmployerFeature(
      employerId,
      'interview_scheduling_enabled',
    );

    const app = await this.appRepo.findOne({
      where: { id: appId, employerId },
      relations: ['candidate', 'job'],
    });
    if (!app) throw new NotFoundException('Application not found');

    const date = new Date(interviewAt);
    if (Number.isNaN(date.getTime())) {
      throw new BadRequestException('Invalid interview date');
    }

    await this.entitlements.assertEmployerMonthlyActionLimit(
      employerId,
      'max_contacted_candidates_per_month',
    );

    app.interviewAt = date;
    await this.applyEmployerStatusTransition(app, ApplicationStatus.INTERVIEW, {
      interviewAt,
    });
    await this.appRepo.save(app);

    if (app.candidate?.email) {
      await this.mail.sendInterviewInvitation({
        to: app.candidate.email,
        jobTitle: app.job?.title ?? 'Job opportunity',
        interviewAt: date,
        message,
      });
    }

    await this.entitlements.trackEmployerMeteredEvent(
      employerId,
      'employer_candidate_contacted',
      { applicationId: app.id, type: 'interview_invitation' },
    );

    return { ok: true, applicationId: app.id, interviewAt: app.interviewAt };
  }

  async sendRejectionMessage(
    appId: number,
    employerId: number,
    rejectionReason: string,
    message?: string,
  ) {
    await this.entitlements.assertEmployerFeature(
      employerId,
      'candidate_contact_enabled',
    );
    await this.entitlements.assertEmployerMonthlyActionLimit(
      employerId,
      'max_contacted_candidates_per_month',
    );

    const app = await this.appRepo.findOne({
      where: { id: appId, employerId },
      relations: ['candidate', 'job'],
    });
    if (!app) throw new NotFoundException('Application not found');

    await this.applyEmployerStatusTransition(app, ApplicationStatus.REJECTED, {
      rejectionReason,
    });
    await this.appRepo.save(app);

    if (app.candidate?.email) {
      await this.mail.sendApplicationRejection({
        to: app.candidate.email,
        jobTitle: app.job?.title ?? 'Job opportunity',
        reason: rejectionReason,
        message,
      });
    }

    await this.entitlements.trackEmployerMeteredEvent(
      employerId,
      'employer_candidate_contacted',
      { applicationId: app.id, type: 'rejection_message' },
    );

    return { ok: true, applicationId: app.id, status: app.status };
  }

  private async applyEmployerStatusTransition(
    app: Application,
    next: ApplicationStatus,
    details?: {
      employerNote?: string;
      rejectionReason?: string;
      interviewAt?: string;
    },
  ) {
    const now = new Date();

    if (details?.employerNote?.trim()) {
      await this.entitlements.assertEmployerFeature(
        Number(app.employerId),
        'candidate_notes_enabled',
      );
      app.employerNote = details.employerNote.trim();
    }

    if (details?.interviewAt) {
      await this.entitlements.assertEmployerFeature(
        Number(app.employerId),
        'interview_scheduling_enabled',
      );
      const interviewAt = new Date(details.interviewAt);
      if (Number.isNaN(interviewAt.getTime())) {
        throw new BadRequestException('Invalid interview date');
      }
      app.interviewAt = interviewAt;
    }

    if (details?.rejectionReason?.trim()) {
      app.rejectionReason = details.rejectionReason.trim();
    }

    app.status = next;

    if (next === ApplicationStatus.VIEWED && !app.viewedAt) {
      app.viewedAt = now;
    }
    if (next === ApplicationStatus.SHORTLISTED && !app.shortlistedAt) {
      app.shortlistedAt = now;
      if (!app.viewedAt) app.viewedAt = now;
    }
    if (next === ApplicationStatus.INTERVIEW && !app.interviewedAt) {
      app.interviewedAt = now;
      if (!app.shortlistedAt) app.shortlistedAt = now;
      if (!app.viewedAt) app.viewedAt = now;
    }
    if (next === ApplicationStatus.OFFERED && !app.offeredAt) {
      app.offeredAt = now;
      if (!app.interviewedAt) app.interviewedAt = now;
      if (!app.shortlistedAt) app.shortlistedAt = now;
      if (!app.viewedAt) app.viewedAt = now;
    }
    if (next === ApplicationStatus.REJECTED && !app.rejectedAt) {
      app.rejectedAt = now;
      if (!app.viewedAt) app.viewedAt = now;
    }
  }
}
