import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { CandidateProfilesService } from './candidate-profile.service';
import { CandidateProfile } from './entities/candidate-profile.entity';
import { CandidateExperience } from './entities/candidate-experience.entity';
import { CandidateEducation } from './entities/candidate-education.entity';
import { CandidateResume } from './entities/candidate-resume.entity';
import { EntitlementsService } from 'src/subscriptions/entitlements.service';

describe('CandidateProfilesService', () => {
  let service: CandidateProfilesService;
  const profiles = {};
  const exps = {};
  const edus = {};
  const resumes = {
    count: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
  };
  const entitlements = {
    assertCandidateLimit: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CandidateProfilesService,
        { provide: getRepositoryToken(CandidateProfile), useValue: profiles },
        { provide: getRepositoryToken(CandidateExperience), useValue: exps },
        { provide: getRepositoryToken(CandidateEducation), useValue: edus },
        { provide: getRepositoryToken(CandidateResume), useValue: resumes },
        { provide: EntitlementsService, useValue: entitlements },
      ],
    }).compile();

    service = module.get<CandidateProfilesService>(CandidateProfilesService);
  });

  it('checks the stored CVs limit before adding a resume', async () => {
    resumes.count.mockResolvedValue(2);
    entitlements.assertCandidateLimit.mockResolvedValue(undefined);
    resumes.create.mockReturnValue({ userId: 8, filePath: '/cv.pdf' });
    resumes.save.mockResolvedValue({ id: 1, userId: 8, filePath: '/cv.pdf' });

    await service.addResume(8, { filePath: '/cv.pdf' } as any);

    expect(entitlements.assertCandidateLimit).toHaveBeenCalledWith(
      8,
      'max_stored_cvs',
      2,
    );
  });
});
