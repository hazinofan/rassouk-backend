import { Entity, PrimaryGeneratedColumn, Column, Index, CreateDateColumn } from 'typeorm';

@Entity('events_job_click')
export class JobClickEvent {
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

  @CreateDateColumn({ type: 'datetime' })
  createdAt: Date;
}
