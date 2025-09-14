// job-bookmark.entity.ts
import { Entity, PrimaryGeneratedColumn, ManyToOne, Column, CreateDateColumn, Unique, JoinColumn, Index } from 'typeorm';
import { User } from 'src/users/users.entity';
import { Job } from 'src/jobs/entities/job.entity';

@Entity('job_bookmarks')
@Unique(['userId', 'jobId'])
export class JobBookmark {
  @PrimaryGeneratedColumn()
  id: number;

  
  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' }) user: User;
  @Column() userId: number;
  
  @ManyToOne(() => Job, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'jobId' }) job: Job;
  @Column() jobId: number;
   
  @CreateDateColumn() createdAt: Date;
}

