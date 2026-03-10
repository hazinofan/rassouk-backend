import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { SavedCandidatesService } from './saved_candidate.service';
import { SavedCandidate } from './entities/saved_candidate.entity';
import { EntitlementsService } from 'src/subscriptions/entitlements.service';

describe('SavedCandidatesService', () => {
  let service: SavedCandidatesService;
  const repo = {
    findOne: jest.fn(),
    count: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    find: jest.fn(),
    delete: jest.fn(),
  };
  const entitlements = {
    assertEmployerLimit: jest.fn(),
    getEmployerEntitlements: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SavedCandidatesService,
        { provide: getRepositoryToken(SavedCandidate), useValue: repo },
        { provide: EntitlementsService, useValue: entitlements },
      ],
    }).compile();

    service = module.get<SavedCandidatesService>(SavedCandidatesService);
  });

  it('checks the saved candidates limit before saving', async () => {
    repo.findOne.mockResolvedValue(null);
    repo.count.mockResolvedValue(3);
    entitlements.assertEmployerLimit.mockResolvedValue(undefined);
    repo.create.mockReturnValue({});
    repo.save.mockResolvedValue({ id: 1 });

    await service.saveCandidate({ id: 14 } as any, { id: 99 } as any);

    expect(entitlements.assertEmployerLimit).toHaveBeenCalledWith(
      14,
      'max_saved_candidates',
      3,
    );
  });

  it('masks resumes when CV access is not available', async () => {
    entitlements.getEmployerEntitlements.mockResolvedValue({
      audience: 'employer',
      planKey: 'free',
      status: 'active',
      startedAt: null,
      currentPeriodEnd: null,
      features: {},
      limits: { cv_access_days: 0 },
    });
    repo.find.mockResolvedValue([
      {
        candidate: {
          candidateProfile: {
            resumes: [{ id: 1, filePath: '/public/resumes/cv.pdf' }],
          },
        },
      },
    ]);

    const result = await service.getSavedCandidates(14);

    expect(result[0].candidate.candidateProfile.resumes[0]).toMatchObject({
      filePath: null,
      locked: true,
    });
  });
});
