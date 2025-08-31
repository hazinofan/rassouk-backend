import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, CreateDateColumn } from 'typeorm';
import { CandidateProfile } from './candidate-profile.entity';

@Entity('candidate_resumes')
export class CandidateResume {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'user_id' })
  userId: number;

  @ManyToOne(() => CandidateProfile, (p) => p.resumes, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  profile: CandidateProfile;

  @Column({ length: 255 })
  filePath: string; // path in /public/resumes/...

  @Column({ length: 160, nullable: true })
  label?: string; // "CV FR", "CV EN"...

  @CreateDateColumn()
  uploadedAt: Date;
}
