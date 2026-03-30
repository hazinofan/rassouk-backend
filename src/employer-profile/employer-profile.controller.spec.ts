import { Test, TestingModule } from '@nestjs/testing';
import { EmployerProfilesController } from './employer-profile.controller';
import { EmployerProfilesService } from './employer-profile.service';

describe('EmployerProfilesController', () => {
  let controller: EmployerProfilesController;

  const serviceMock = {
    getMine: jest.fn(),
    upsertMine: jest.fn(),
    getStatus: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [EmployerProfilesController],
      providers: [{ provide: EmployerProfilesService, useValue: serviceMock }],
    }).compile();

    controller = module.get<EmployerProfilesController>(EmployerProfilesController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
