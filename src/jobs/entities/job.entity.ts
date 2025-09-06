import { User } from 'src/users/users.entity';
import {
  Entity, PrimaryGeneratedColumn, Column, ManyToOne, Index,
  CreateDateColumn, UpdateDateColumn, DeleteDateColumn
} from 'typeorm';

export enum SalaryType { MONTHLY='MONTHLY', YEARLY='YEARLY', HOURLY='HOURLY' }
export enum JobType { FULL_TIME='FULL_TIME', PART_TIME='PART_TIME', INTERNSHIP='INTERNSHIP', CONTRACT='CONTRACT', FREELANCE='FREELANCE' }
export enum JobLevel { JUNIOR='JUNIOR', MID='MID', SENIOR='SENIOR', LEAD='LEAD' }
export enum JobStatus { DRAFT='DRAFT', ACTIVE='ACTIVE', EXPIRED='EXPIRED' }

@Entity('jobs')
@Index(['status', 'expiresAt'])
export class Job {
  @PrimaryGeneratedColumn()
  id: number;

  @Index()
  @Column({ length: 180 })
  title: string;

  @Column({ length: 220, unique: true })
  slug: string;

  @Column({ type: 'longtext', nullable: true, charset: 'utf8mb4', collation: 'utf8mb4_unicode_ci' })
  description?: string; 

  @Column({ type: 'longtext', nullable: true, charset: 'utf8mb4', collation: 'utf8mb4_unicode_ci' })
  responsibilities?: string;

  @Column({ type: 'simple-array', nullable: true })
  tags?: string[]; // "nextjs,react,frontend"

  @Column({ length: 120, nullable: true })
  role?: string; // UI “Job Role”

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  minSalary?: string;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  maxSalary?: string;

  @Column({ type: 'enum', enum: SalaryType, nullable: true })
  salaryType?: SalaryType;

  @Column({ type: 'enum', enum: JobType, nullable: true })
  jobType?: JobType;

  @Column({ type: 'enum', enum: JobLevel, nullable: true })
  jobLevel?: JobLevel;

  @Column({ length: 80, nullable: true })
  education?: string;

  @Column({ length: 80, nullable: true })
  experience?: string; // e.g. "2-3 years"

  @Column({ type: 'int', default: 1 })
  vacancies: number;

  @Column({ length: 3, default: 'USD' })
  currency: string;

  @Column({ length: 120, nullable: true })
  location?: string;

  @Column({ type: 'timestamp', nullable: true })
  expiresAt?: Date;

  @Column({ type: 'enum', enum: JobStatus, default: JobStatus.ACTIVE })
  status: JobStatus;

  @ManyToOne(() => User, (u) => u.jobs, { nullable: false })
  employer: User;

  @CreateDateColumn() createdAt: Date;
  @UpdateDateColumn() updatedAt: Date;
  @DeleteDateColumn() deletedAt?: Date;
}
