// src/job-alerts/job-alert.entity.ts
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  JoinColumn,
} from 'typeorm';
import { CandidateProfile } from 'src/candidate-profile/entities/candidate-profile.entity';

@Entity('job_alerts')
export class JobAlert {
  @PrimaryGeneratedColumn() id: number;

  @ManyToOne(() => CandidateProfile, { onDelete: 'CASCADE', eager: true })
  @JoinColumn({ name: 'candidate_id', referencedColumnName: 'userId' })
  candidate: CandidateProfile;

  @Index() @Column({ nullable: true }) keyword: string;
  @Index() @Column({ nullable: true }) location_city: string;
  @Index() @Column({ nullable: true }) location_country: string;

  @Index() @Column({ nullable: true }) job_type: string;
  @Column({ type: 'simple-array', nullable: true })
  tags?: string[];
  @Index() @Column({ nullable: true }) industry: string;
  @Index() @Column({ nullable: true }) experience_level: string;
  @Column({ type: 'int', nullable: true }) min_salary: number;

  @Column({ default: true }) is_active: boolean;
  @Column({ default: 'sunday' }) send_day: 'sunday';

  @Column({ type: 'datetime', nullable: true }) last_sent_at: Date | null;

  @CreateDateColumn() created_at: Date;
  @UpdateDateColumn() updated_at: Date;
}
