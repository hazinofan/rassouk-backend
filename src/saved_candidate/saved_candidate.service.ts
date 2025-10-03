import { Injectable, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from 'src/users/users.entity';
import { CandidateProfile } from 'src/candidate-profile/entities/candidate-profile.entity';
import { SavedCandidate } from './entities/saved_candidate.entity';

@Injectable()
export class SavedCandidatesService {
  constructor(
    @InjectRepository(SavedCandidate)
    private repo: Repository<SavedCandidate>,
  ) {}

  async saveCandidate(employer: User, candidate: CandidateProfile) {
    const exists = await this.repo.findOne({ where: { employer, candidate } });
    if (exists) throw new ConflictException('Already saved');

    const saved = this.repo.create({ employer, candidate });
    return this.repo.save(saved);
  }

  async getSavedCandidates(employerId: number) {
    return this.repo.find({
      where: { employer: { id: employerId } },
      relations: {
        candidate: {
          candidateProfile: {
            experiences: true, 
            resumes: true,
            educations: true,
          },
        },
      },
    });
  }

  async removeSaved(id: number, employerId: number) {
    await this.repo.delete({ id, employer: { id: employerId } });
    return { success: true };
  }
}
