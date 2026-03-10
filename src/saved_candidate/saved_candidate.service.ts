import { Injectable, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from 'src/users/users.entity';
import { CandidateProfile } from 'src/candidate-profile/entities/candidate-profile.entity';
import { SavedCandidate } from './entities/saved_candidate.entity';
import { EntitlementsService } from 'src/subscriptions/entitlements.service';

@Injectable()
export class SavedCandidatesService {
  constructor(
    @InjectRepository(SavedCandidate)
    private repo: Repository<SavedCandidate>,
    private readonly entitlements: EntitlementsService,
  ) {}

  async saveCandidate(employer: User, candidate: CandidateProfile) {
    const exists = await this.repo.findOne({ where: { employer, candidate } });
    if (exists) throw new ConflictException('Already saved');
    const current = await this.repo.count({ where: { employer: { id: employer.id } } });
    await this.entitlements.assertEmployerLimit(
      employer.id,
      'max_saved_candidates',
      current,
    );

    const saved = this.repo.create({ employer, candidate });
    return this.repo.save(saved);
  }

  async getSavedCandidates(employerId: number) {
    const entitlements = await this.entitlements.getEmployerEntitlements(employerId);
    const items = await this.repo.find({
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
    const canAccessCv =
      entitlements.status === 'active' &&
      this.isCvWindowOpen(entitlements.startedAt, entitlements.limits.cv_access_days);

    return items.map((item: any) => ({
      ...item,
      candidate: {
        ...item.candidate,
        candidateProfile: item.candidate?.candidateProfile
          ? {
              ...item.candidate.candidateProfile,
              resumes: canAccessCv
                ? item.candidate.candidateProfile.resumes
                : (item.candidate.candidateProfile.resumes ?? []).map(
                    (resume: any) => ({
                      ...resume,
                      filePath: null,
                      url: null,
                      locked: true,
                    }),
                  ),
            }
          : item.candidate?.candidateProfile,
      },
    }));
  }

  async removeSaved(id: number, employerId: number) {
    await this.repo.delete({ id, employer: { id: employerId } });
    return { success: true };
  }

  private isCvWindowOpen(
    startedAt: Date | null,
    cvAccessDays: number | null,
  ): boolean {
    if (!startedAt || cvAccessDays === null || cvAccessDays <= 0) {
      return false;
    }

    const cutoff = new Date(startedAt.getTime() + cvAccessDays * 24 * 60 * 60 * 1000);
    return cutoff >= new Date();
  }
}
