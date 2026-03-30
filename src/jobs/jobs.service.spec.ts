import { Test, TestingModule } from '@nestjs/testing';
import { JobsService } from './jobs.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import {
  Job,
  JobApplicationMode,
  JobStatus,
} from './entities/job.entity';
import { EntitlementsService } from 'src/subscriptions/entitlements.service';
import { JobRefreshEvent } from './entities/job-refresh-event.entity';

describe('JobsService', () => {
  let service: JobsService;
  const repo = {
    count: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    findOne: jest.fn(),
  };
  const entitlements = {
    assertEmployerLimit: jest.fn(),
    assertEmployerFeature: jest.fn(),
    assertEmployerMonthlyActionLimit: jest.fn(),
  };
  const refreshEventsRepo = {
    save: jest.fn(),
    create: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        JobsService,
        { provide: getRepositoryToken(Job), useValue: repo },
        {
          provide: getRepositoryToken(JobRefreshEvent),
          useValue: refreshEventsRepo,
        },
        { provide: EntitlementsService, useValue: entitlements },
      ],
    }).compile();

    service = module.get<JobsService>(JobsService);
  });

  it('checks the active jobs limit before creating a job', async () => {
    repo.count.mockResolvedValue(1);
    entitlements.assertEmployerLimit.mockResolvedValue(undefined);
    repo.create.mockReturnValue({ title: 'Backend Engineer' });
    repo.save.mockResolvedValue({ id: 10, title: 'Backend Engineer' });

    await service.create({ title: 'Backend Engineer' } as any, 42);

    expect(entitlements.assertEmployerLimit).toHaveBeenCalledWith(
      42,
      'max_active_jobs',
      1,
    );
    expect(repo.save).toHaveBeenCalled();
    expect(repo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        applicationMode: JobApplicationMode.INTERNAL,
        externalApplyUrl: null,
      }),
    );
  });

  it('checks the active jobs limit when reactivating a job', async () => {
    repo.findOne.mockResolvedValue({ id: 9, status: JobStatus.DRAFT });
    repo.count.mockResolvedValue(5);
    entitlements.assertEmployerLimit.mockResolvedValue(undefined);
    repo.save.mockResolvedValue({ id: 9, status: JobStatus.ACTIVE });

    await service.updateStatus(9, 42, JobStatus.ACTIVE);

    expect(entitlements.assertEmployerLimit).toHaveBeenCalledWith(
      42,
      'max_active_jobs',
      5,
    );
  });

  it('requires an external application URL for external jobs', async () => {
    repo.count.mockResolvedValue(0);
    entitlements.assertEmployerLimit.mockResolvedValue(undefined);
    entitlements.assertEmployerFeature.mockResolvedValue(undefined);

    await expect(
      service.create(
        {
          title: 'Backend Engineer',
          applicationMode: JobApplicationMode.EXTERNAL,
        } as any,
        42,
      ),
    ).rejects.toThrow(
      'externalApplyUrl is required when applicationMode is EXTERNAL',
    );
  });

  it('keeps a valid external URL when updating an external job', async () => {
    repo.findOne.mockResolvedValue({
      id: 9,
      title: 'Backend Engineer',
      slug: 'backend-engineer-123',
      applicationMode: JobApplicationMode.EXTERNAL,
      externalApplyUrl: 'https://old.example.com/jobs/1',
      isFeatured: false,
      boostedUntil: null,
    });
    entitlements.assertEmployerFeature.mockResolvedValue(undefined);
    repo.save.mockResolvedValue({ id: 9 });

    await service.update(9, 42, {
      externalApplyUrl: 'https://company.example.com/jobs/backend',
    } as any);

    expect(repo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        applicationMode: JobApplicationMode.EXTERNAL,
        externalApplyUrl: 'https://company.example.com/jobs/backend',
      }),
    );
  });
});
