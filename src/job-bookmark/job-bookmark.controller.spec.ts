import { Test, TestingModule } from '@nestjs/testing';
import { JobBookmarkController } from './job-bookmark.controller';
import { JobBookmarkService } from './job-bookmark.service';

describe('JobBookmarkController', () => {
  let controller: JobBookmarkController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [JobBookmarkController],
      providers: [JobBookmarkService],
    }).compile();

    controller = module.get<JobBookmarkController>(JobBookmarkController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
