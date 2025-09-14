import {
  BadRequestException,
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
}
