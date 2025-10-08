import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  Index,
  CreateDateColumn,
} from 'typeorm';

@Entity('events_job_click')
@Index('ux_click_job_session_day', ['jobId', 'sessionId', 'clickDate'], { unique: true })
@Index('ix_click_created', ['createdAt'])
@Index('ix_click_job_created', ['jobId', 'createdAt'])
export class JobClickEvent {
  @PrimaryGeneratedColumn()
  id: number;

  @Index()
  @Column('int')
  jobId: number; // FK → jobs.id

  @Column('int', { nullable: true })
  tenantId: number | null;

  @Index()
  @Column({ type: 'varchar', length: 64, nullable: true })
  sessionId: string | null;

  @Column({ type: 'varchar', length: 64, nullable: true })
  source: string | null;

  // UTC day bucket for idempotency & fast aggregations
  @Column({ type: 'date' })
  clickDate: string; // YYYY-MM-DD (UTC)

  @CreateDateColumn({ type: 'datetime' })
  createdAt: Date;
}
