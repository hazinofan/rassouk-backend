import { Test, TestingModule } from '@nestjs/testing';
import { EmployerProfileService } from './employer-profile.service';

describe('EmployerProfileService', () => {
  let service: EmployerProfileService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [EmployerProfileService],
    }).compile();

    service = module.get<EmployerProfileService>(EmployerProfileService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
