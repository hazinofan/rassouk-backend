import { BadRequestException, InternalServerErrorException } from '@nestjs/common';
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

describe('EmployerProfilesService', () => {
  let service: EmployerProfilesService;

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

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmployerProfilesService,
        { provide: getRepositoryToken(EmployerProfile), useValue: profileRepo },
        { provide: getRepositoryToken(User), useValue: usersRepo },
      ],
    }).compile();

    service = module.get<EmployerProfilesService>(EmployerProfilesService);
  });

  it('normalizes nullable empty strings to null and parses yearEstablished', async () => {
    profileRepo.findOne.mockResolvedValue(null);
    profileRepo.create.mockImplementation((x: any) => x);
    profileRepo.save.mockImplementation(async (x: any) => x);
    usersRepo.findOne.mockResolvedValue({ id: 10, onboardingStep: 0, isOnboarded: false, role: 'employer' });
    usersRepo.save.mockResolvedValue({});

    const result = await service.upsertMine(10, {
      companyName: ' ACME Inc ',
      about: ' About us ',
      industryType: ' Technology ',
      teamSize: TeamSize.S_11_50,
      contactEmail: ' jobs@acme.test ',
      organizationType: OrganizationType.COMPANY,
      logoUrl: '',
      bannerUrl: '   ',
      facebookUrl: '',
      address: ' ',
      companyPhone: '',
      employerPhone: ' +1-555 ',
      yearEstablished: '2020-07-11T00:00:00.000Z',
      step: 2,
    } as any);

    expect(profileRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 10,
        companyName: 'ACME Inc',
        about: 'About us',
        industryType: 'Technology',
        logoUrl: null,
        bannerUrl: null,
        facebookUrl: null,
        address: null,
        companyPhone: null,
        employerPhone: '+1-555',
        contactEmail: 'jobs@acme.test',
        yearEstablished: '2020-07-11',
      }),
    );

    expect(result.yearEstablished).toBe('2020-07-11');
  });

  it('throws when table mapping is empty', async () => {
    profileRepo.metadata.tableName = '';

    await expect(
      service.upsertMine(1, {
        companyName: 'ACME',
        about: 'desc',
        industryType: 'tech',
        teamSize: TeamSize.S_1_10,
        contactEmail: 'a@b.c',
      } as any),
    ).rejects.toBeInstanceOf(InternalServerErrorException);

    profileRepo.metadata.tableName = EMPLOYER_PROFILE_TABLE;
  });

  it('rejects missing required onboarding fields on create', async () => {
    profileRepo.findOne.mockResolvedValue(null);

    await expect(
      service.upsertMine(2, {
        companyName: 'ACME',
        about: '',
        industryType: 'tech',
        teamSize: TeamSize.S_1_10,
        contactEmail: 'a@b.c',
      } as any),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
