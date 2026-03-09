import { Test, TestingModule } from '@nestjs/testing';
import { CacheModule } from '@nestjs/cache-manager';
import { StatsController } from './stats.controller';
import { AnalyticsService } from './stats.service';

describe('StatsController', () => {
  let controller: StatsController;
  const analyticsMock = { getEmployerOverview: jest.fn() };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [CacheModule.register()],
      controllers: [StatsController],
      providers: [{ provide: AnalyticsService, useValue: analyticsMock }],
    }).compile();

    controller = module.get<StatsController>(StatsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
