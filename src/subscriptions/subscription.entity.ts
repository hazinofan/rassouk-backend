import { User } from 'src/users/users.entity';
import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import type {
  PlanKey,
  SubscriptionAudience,
  SubscriptionStatus,
} from './subscription.types';

@Entity('subscriptions')
@Index(['tenant', 'audience'])
export class Subscription {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => User, { nullable: false, onDelete: 'CASCADE' })
  tenant: User;

  @Column({
    type: 'enum',
    enum: ['employer', 'candidate'],
    default: 'employer',
  })
  audience: SubscriptionAudience;

  @Column({ type: 'varchar', length: 32, default: 'free' })
  planKey: PlanKey;

  @Column({
    type: 'enum',
    enum: ['active', 'canceled', 'inactive', 'past_due', 'trialing'],
    default: 'active',
  })
  status: SubscriptionStatus;

  @Column({ type: 'timestamp', nullable: true })
  startedAt: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  currentPeriodEnd: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  canceledAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
