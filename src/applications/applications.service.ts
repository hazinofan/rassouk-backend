import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Application, ApplicationStatus } from './entities/application.entity';
import { Job, JobStatus } from 'src/jobs/entities/job.entity';
import { CandidateProfile } from 'src/candidate-profile/entities/candidate-profile.entity';
import { CreateApplicationDto } from './dto/create-application.dto';
import { MailService } from 'src/mail/mail.service';
import { QueryApplicationsDto } from './dto/query-applications.dto';

@Injectable()
export class ApplicationsService {
  constructor(
    @InjectRepository(Application) private appRepo: Repository<Application>,
    @InjectRepository(Job) private jobRepo: Repository<Job>,
    @InjectRepository(CandidateProfile)
    private profRepo: Repository<CandidateProfile>,
    private mail: MailService,
  ) {}

  async create(jobId: number, candidateId: number, dto: CreateApplicationDto) {
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

    return saved;
  }

  async getAppById (id: number) {
    return this.appRepo.findOne({
      where: { id },
      relations: {
        candidate: {
          candidateProfile: {
            experiences: true,
            educations: true
          }
        },
        job: true
      }
    })
  }

  async updateStatusForEmployer(
    appId: number,
    employerId: number,
    next: ApplicationStatus,
  ) {
    const app = await this.appRepo.findOne({ where: { id: appId } });
    if (!app) throw new NotFoundException('Application not found');
    if (app.employerId !== employerId)
      throw new ForbiddenException('You do not own this application');

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

    app.status = next;
    await this.appRepo.save(app);
    return { id: app.id, status: app.status };
  }

  async getApplicationsForJob(jobId: number, employerId: number) {
    const job = await this.jobRepo.findOne({
      where: { id: jobId, employer: { id: employerId } },
      relations: ['applications', 'applications.candidate'],
    });

    if (!job) throw new NotFoundException('Job not found or not owned by you');

    return job.applications;
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

    const [data, total] = await qb.getManyAndCount();
    return { data, total, page, limit };
  }
}
