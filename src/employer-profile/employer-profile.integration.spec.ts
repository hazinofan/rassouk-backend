import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { EmployerProfilesService } from './employer-profile.service';
import {
  EMPLOYER_PROFILE_TABLE,
  EmployerProfile,
  OrganizationType,
  TeamSize,
} from './entities/employer-profile.entity';
import { User } from 'src/users/users.entity';
import { EmployerProfilesController } from './employer-profile.controller';

describe('Employer onboarding integration (production-like)', () => {
  let controller: EmployerProfilesController;

  const profileRepo = {
    metadata: { tableName: EMPLOYER_PROFILE_TABLE },
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
  };

  const usersRepo = {
    findOne: jest.fn(),
    save: jest.fn(),
  };

  const previousNodeEnv = process.env.NODE_ENV;

  beforeAll(() => {
    process.env.NODE_ENV = 'production';
  });

  afterAll(() => {
    process.env.NODE_ENV = previousNodeEnv;
  });

  beforeEach(async () => {
    jest.clearAllMocks();

    profileRepo.findOne.mockResolvedValue(null);
    profileRepo.create.mockImplementation((x: any) => x);
    profileRepo.save.mockImplementation(async (x: any) => ({ ...x, createdAt: new Date(), updatedAt: new Date() }));

    usersRepo.findOne.mockResolvedValue({ id: 42, onboardingStep: 0, isOnboarded: false, role: 'employer' });
    usersRepo.save.mockResolvedValue({});

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmployerProfilesService,
        { provide: getRepositoryToken(EmployerProfile), useValue: profileRepo },
        { provide: getRepositoryToken(User), useValue: usersRepo },
      ],
    }).compile();

    const service = module.get<EmployerProfilesService>(EmployerProfilesService);
    controller = new EmployerProfilesController(service);
  });

  it('creates in employer_profiles and stores nullable empty strings as null', async () => {
    const req = { user: { id: 42 } };

    await controller.upsertMe(req as any, {
      companyName: 'Example Corp',
      about: 'We build products',
      industryType: 'Software',
      teamSize: TeamSize.S_11_50,
      contactEmail: 'contact@example.com',
      organizationType: OrganizationType.COMPANY,
      logoUrl: '',
      bannerUrl: '',
      facebookUrl: '',
      instagramUrl: '',
      twitterUrl: '',
      linkedinUrl: '',
      address: '',
      companyPhone: '',
      employerPhone: '',
      yearEstablished: '2015-05-20T10:00:00.000Z',
      step: 1,
    } as any);

    expect(profileRepo.metadata.tableName).toBe(EMPLOYER_PROFILE_TABLE);
    expect(profileRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 42,
        logoUrl: null,
        bannerUrl: null,
        facebookUrl: null,
        instagramUrl: null,
        twitterUrl: null,
        linkedinUrl: null,
        address: null,
        companyPhone: null,
        employerPhone: null,
        yearEstablished: '2015-05-20',
      }),
    );
  });
});
