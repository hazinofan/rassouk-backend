import { Test, TestingModule } from '@nestjs/testing';
import { JobBookmarkService } from './job-bookmark.service';

describe('JobBookmarkService', () => {
  let service: JobBookmarkService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [JobBookmarkService],
    }).compile();

    service = module.get<JobBookmarkService>(JobBookmarkService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
