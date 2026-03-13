import { User } from 'src/users/users.entity';
import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Job } from './job.entity';

@Entity('job_refresh_events')
@Index(['employerId', 'createdAt'])
export class JobRefreshEvent {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  employerId: number;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  employer: User;

  @Column()
  jobId: number;

  @ManyToOne(() => Job, { onDelete: 'CASCADE' })
  job: Job;

  @CreateDateColumn()
  createdAt: Date;
}
