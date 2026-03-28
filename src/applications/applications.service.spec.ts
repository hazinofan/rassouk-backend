import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ApplicationsService } from './applications.service';
import { Application } from './entities/application.entity';
import { Job, JobApplicationMode, JobStatus } from 'src/jobs/entities/job.entity';
import { CandidateProfile } from 'src/candidate-profile/entities/candidate-profile.entity';
import { MailService } from 'src/mail/mail.service';
import { EntitlementsService } from 'src/subscriptions/entitlements.service';
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { NotificationsService } from 'src/notifications/notifications.service';

describe('ApplicationsService', () => {
  let service: ApplicationsService;
  const appRepo = {
    count: jest.fn(),
    findOne: jest.fn(),
    exists: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
  };
  const jobRepo = {
    findOne: jest.fn(),
  };
  const profileRepo = {
    findOne: jest.fn(),
  };
  const mail = {
    sendApplicationConfirmation: jest.fn(),
  };
  const notifications = {
    create: jest.fn(),
  };
  const entitlements = {
    getMonthBetweenClause: jest.fn(),
    assertCandidateLimit: jest.fn(),
    getEmployerEntitlements: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ApplicationsService,
        { provide: getRepositoryToken(Application), useValue: appRepo },
        { provide: getRepositoryToken(Job), useValue: jobRepo },
        { provide: getRepositoryToken(CandidateProfile), useValue: profileRepo },
        { provide: MailService, useValue: mail },
        { provide: NotificationsService, useValue: notifications },
        { provide: EntitlementsService, useValue: entitlements },
      ],
    }).compile();

    service = module.get<ApplicationsService>(ApplicationsService);
  });

  it('checks the candidate monthly applications limit before creating an application', async () => {
    const monthRange = {} as any;
    entitlements.getMonthBetweenClause.mockReturnValue(monthRange);
    appRepo.count.mockResolvedValue(10);
    entitlements.assertCandidateLimit.mockRejectedValue(new Error('stop'));

    await expect(service.create(12, 44, {} as any)).rejects.toThrow('stop');

    expect(appRepo.count).toHaveBeenCalledWith({
      where: {
        candidate: { id: 44 },
        createdAt: monthRange,
      },
    });
    expect(entitlements.assertCandidateLimit).toHaveBeenCalledWith(
      44,
      'max_applications_per_month',
      10,
    );
  });

  it('masks employer resume access when CV window is closed', async () => {
    appRepo.findOne.mockResolvedValue({
      id: 9,
      employerId: 14,
      candidate: {
        id: 77,
        candidateProfile: {
          resumes: [{ id: 1, filePath: '/public/resumes/cv.pdf' }],
        },
      },
      job: { employer: { id: 14 } },
      resumeUrl: '/public/resumes/cv.pdf',
    });
    entitlements.getEmployerEntitlements.mockResolvedValue({
      audience: 'employer',
      planKey: 'free',
      status: 'active',
      startedAt: null,
      currentPeriodEnd: null,
      features: {},
      limits: { cv_access_days: 0 },
    });

    const result = await service.getAppById(9, { id: 14, role: 'employer' });

    expect(result).toMatchObject({
      resumeUrl: null,
      cvLocked: true,
    });
    expect((result as any).candidate.candidateProfile.resumes[0].filePath).toBeNull();
  });

  it('blocks users who do not own the application', async () => {
    appRepo.findOne.mockResolvedValue({
      id: 9,
      employerId: 14,
      candidate: { id: 77, candidateProfile: { resumes: [] } },
      job: { employer: { id: 14 } },
    });

    await expect(
      service.getAppById(9, { id: 99, role: 'candidat' }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('blocks direct internal applications for external jobs', async () => {
    const monthRange = {} as any;
    entitlements.getMonthBetweenClause.mockReturnValue(monthRange);
    entitlements.assertCandidateLimit.mockResolvedValue(undefined);
    appRepo.count.mockResolvedValue(0);
    jobRepo.findOne.mockResolvedValue({
      id: 12,
      title: 'Backend Engineer',
      status: JobStatus.ACTIVE,
      applicationMode: JobApplicationMode.EXTERNAL,
      expiresAt: null,
    });

    await expect(service.create(12, 44, {} as any)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });
});
