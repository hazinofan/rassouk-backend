// src/stats/entities/job-view-event.entity.ts
import { Entity, PrimaryGeneratedColumn, Column, Index, CreateDateColumn } from 'typeorm';

@Entity('events_job_view')
@Index('ux_view_job_session_day', ['jobId', 'sessionId', 'viewDate'], { unique: true })
@Index('ix_view_created', ['createdAt'])
@Index('ix_view_job_created', ['jobId', 'createdAt'])
export class JobEvent {
  @PrimaryGeneratedColumn()
  id: number;

  @Index()
  @Column('int')
  jobId: number;

  @Column('int', { nullable: true })
  tenantId: number | null;

  @Index()
  @Column({ type: 'varchar', length: 64, nullable: true })
  sessionId: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  referrer: string | null;

  // 👇 add this
  @Column({ type: 'varchar', length: 64, nullable: true })
  source: string | null;

  // ensure this exists too
  @Column({ type: 'date' })
  viewDate: string;

  @CreateDateColumn({ type: 'datetime' })
  createdAt: Date;
}
