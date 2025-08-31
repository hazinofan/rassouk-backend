import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from 'typeorm';
import { CandidateProfile } from './candidate-profile.entity';

@Entity('candidate_experiences')
export class CandidateExperience {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'user_id' })
  userId: number;

  @ManyToOne(() => CandidateProfile, (p) => p.experiences, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  profile: CandidateProfile;

  @Column({ length: 160 })
  title: string; // "what he does"

  @Column({ type: 'smallint' })
  year: number; // year of accomplishment

  @Column({ type: 'text', nullable: true })
  description?: string;
}
