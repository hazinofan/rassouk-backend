import { User } from 'src/users/users.entity';
import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';

export enum NotificationType {
  NEW_APPLICATION = 'NEW_APPLICATION',
  APPLICATION_STATUS_CHANGED = 'APPLICATION_STATUS_CHANGED',
  JOB_EXPIRING_SOON = 'JOB_EXPIRING_SOON',
  JOB_EXPIRED = 'JOB_EXPIRED',
  JOB_NO_APPLICATIONS_3_DAYS = 'JOB_NO_APPLICATIONS_3_DAYS',
  SYSTEM = 'SYSTEM',
}

@Entity('notifications')
@Index(['userId', 'isRead', 'createdAt'])
export class Notification {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  userId: number;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column({
    type: 'enum',
    enum: NotificationType,
    default: NotificationType.SYSTEM,
  })
  type: NotificationType;

  @Column({ length: 180 })
  title: string;

  @Column({ type: 'text' })
  message: string;

  @Column({ type: 'json', nullable: true })
  payload?: Record<string, unknown> | null;

  // Prevent duplicate system notifications for the same event/job.
  @Index({ unique: true })
  @Column({ type: 'varchar', length: 191, nullable: true })
  uniqueKey?: string | null;

  @Column({ default: false })
  isRead: boolean;

  @Column({ type: 'timestamp', nullable: true })
  readAt?: Date | null;

  @CreateDateColumn()
  createdAt: Date;
}
