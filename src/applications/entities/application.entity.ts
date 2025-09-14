// src/applications/entities/application.entity.ts
import {
  Entity, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn,
  Column, ManyToOne, Unique, Index
} from 'typeorm';
import { Job } from 'src/jobs/entities/job.entity';
import { User } from 'src/users/users.entity';

export enum ApplicationStatus {
  SUBMITTED='SUBMITTED', VIEWED='VIEWED', SHORTLISTED='SHORTLISTED',
  INTERVIEW='INTERVIEW', OFFERED='OFFERED', REJECTED='REJECTED', WITHDRAWN='WITHDRAWN'
}

@Entity('applications')
@Unique(['job', 'candidate']) // prevent duplicate apply
export class Application {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Job, job => job.applications, { onDelete: 'CASCADE', eager: false })
  @Index()
  job: Job;

  @ManyToOne(() => User, user => user.applications, { onDelete: 'CASCADE', eager: false })
  @Index()
  candidate: User;

  // denormalized to speed employer filters (optional)
  @Column({ nullable: true })
  employerId?: number;

  @Column({ type: 'varchar', length: 255, nullable: true })
  resumeUrl?: string;

  @Column({ type: 'text', nullable: true })
  coverLetter?: string | null;

  @Column({ type: 'varchar', length: 40, default: 'JOB_PAGE' })
  source: string;

  @Column({ type: 'enum', enum: ApplicationStatus, default: ApplicationStatus.SUBMITTED })
  status: ApplicationStatus;

  @CreateDateColumn() createdAt: Date;
  @UpdateDateColumn() updatedAt: Date;
}
