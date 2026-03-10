import { Test, TestingModule } from '@nestjs/testing';
import { JobsService } from './jobs.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Job, JobStatus } from './entities/job.entity';
import { EntitlementsService } from 'src/subscriptions/entitlements.service';

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
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        JobsService,
        { provide: getRepositoryToken(Job), useValue: repo },
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
});
