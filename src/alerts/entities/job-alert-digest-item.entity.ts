// src/job-alerts/job-alert-digest-item.entity.ts
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm';

@Entity('job_alert_digest_items')
@Index(['alert_id', 'job_id', 'week_of'], { unique: true })
export class JobAlertDigestItem {
  @PrimaryGeneratedColumn() id: number;

  @Column() alert_id: number;
  @Column() job_id: number;

  @Column({ type: 'date' }) week_of: string;

  @CreateDateColumn() created_at: Date;
}
