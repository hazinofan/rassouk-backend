import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { AnalyticsService } from './stats.service';
import { Job } from '../jobs/entities/job.entity';
import { Application } from '../applications/entities/application.entity';
import { JobEvent } from './entities/job-view-event.entity';
import { JobClickEvent } from './entities/job-click-event.entity';

describe('AnalyticsService', () => {
  let service: AnalyticsService;

  const repoMock = { find: jest.fn(), createQueryBuilder: jest.fn(), insert: jest.fn() };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AnalyticsService,
        { provide: getRepositoryToken(Job), useValue: repoMock },
        { provide: getRepositoryToken(Application), useValue: repoMock },
        { provide: getRepositoryToken(JobEvent), useValue: repoMock },
        { provide: getRepositoryToken(JobClickEvent), useValue: repoMock },
      ],
    }).compile();

    service = module.get<AnalyticsService>(AnalyticsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
