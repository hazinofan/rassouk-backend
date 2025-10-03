import { Test, TestingModule } from '@nestjs/testing';
import { SavedCandidateController } from './saved_candidate.controller';
import { SavedCandidateService } from './saved_candidate.service';

describe('SavedCandidateController', () => {
  let controller: SavedCandidateController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [SavedCandidateController],
      providers: [SavedCandidateService],
    }).compile();

    controller = module.get<SavedCandidateController>(SavedCandidateController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
