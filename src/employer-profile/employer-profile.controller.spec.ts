import { Test, TestingModule } from '@nestjs/testing';
import { EmployerProfileController } from './employer-profile.controller';
import { EmployerProfileService } from './employer-profile.service';

describe('EmployerProfileController', () => {
  let controller: EmployerProfileController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [EmployerProfileController],
      providers: [EmployerProfileService],
    }).compile();

    controller = module.get<EmployerProfileController>(EmployerProfileController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
