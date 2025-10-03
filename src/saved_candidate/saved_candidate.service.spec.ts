import { Test, TestingModule } from '@nestjs/testing';
import { SavedCandidateService } from './saved_candidate.service';

describe('SavedCandidateService', () => {
  let service: SavedCandidateService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [SavedCandidateService],
    }).compile();

    service = module.get<SavedCandidateService>(SavedCandidateService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
