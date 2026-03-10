import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { JobBookmarksService } from './job-bookmark.service';
import { JobBookmark } from './entities/job-bookmark.entity';
import { EntitlementsService } from 'src/subscriptions/entitlements.service';

describe('JobBookmarksService', () => {
  let service: JobBookmarksService;
  const repo = {
    count: jest.fn(),
    createQueryBuilder: jest.fn(),
  };
  const qb = {
    insert: jest.fn().mockReturnThis(),
    into: jest.fn().mockReturnThis(),
    values: jest.fn().mockReturnThis(),
    orIgnore: jest.fn().mockReturnThis(),
    execute: jest.fn(),
  };
  const entitlements = {
    assertCandidateLimit: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    repo.createQueryBuilder.mockReturnValue(qb);
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        JobBookmarksService,
        { provide: getRepositoryToken(JobBookmark), useValue: repo },
        { provide: EntitlementsService, useValue: entitlements },
      ],
    }).compile();

    service = module.get<JobBookmarksService>(JobBookmarksService);
  });

  it('checks the saved jobs limit before bookmarking', async () => {
    repo.count.mockResolvedValue(10);
    entitlements.assertCandidateLimit.mockResolvedValue(undefined);
    qb.execute.mockResolvedValue(undefined);

    await service.add(5, 9);

    expect(entitlements.assertCandidateLimit).toHaveBeenCalledWith(
      5,
      'max_saved_jobs',
      10,
    );
  });
});
