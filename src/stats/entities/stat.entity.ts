import { Entity, PrimaryGeneratedColumn, Column, Index, CreateDateColumn } from 'typeorm';

@Entity('events_job_view')
export class JobViewEvent {
  @PrimaryGeneratedColumn()
  id: number;

  @Index()
  @Column('int')
  jobId: number;

  @Index()
  @Column('int')
  tenantId: number;

  @Index()
  @Column({ type: 'varchar', length: 64, nullable: true })
  sessionId: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  referrer: string | null;

  @CreateDateColumn({ type: 'datetime' })
  createdAt: Date;
}
