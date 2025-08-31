import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from 'typeorm';
import { CandidateProfile } from './candidate-profile.entity';

@Entity('candidate_educations')
export class CandidateEducation {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'user_id' })
  userId: number;

  @ManyToOne(() => CandidateProfile, (p) => p.educations, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  profile: CandidateProfile;

  @Column({ length: 160 })
  degree: string;

  @Column({ type: 'smallint' })
  year: number;

  @Column({ length: 160, nullable: true })
  institution?: string;
}
