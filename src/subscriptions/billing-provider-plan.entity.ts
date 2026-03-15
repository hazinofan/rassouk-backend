import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import type {
  BillingEnvironment,
  BillingProvider,
  PlanKey,
  SubscriptionAudience,
} from './subscription.types';

@Entity('billing_provider_plans')
@Index(['provider', 'environment', 'audience', 'planKey'], { unique: true })
export class BillingProviderPlan {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 16 })
  provider: BillingProvider;

  @Column({ type: 'varchar', length: 16 })
  environment: BillingEnvironment;

  @Column({
    type: 'enum',
    enum: ['employer', 'candidate'],
  })
  audience: SubscriptionAudience;

  @Column({ type: 'varchar', length: 32 })
  planKey: PlanKey;

  @Column({ type: 'varchar', length: 128, nullable: true })
  externalProductId: string | null;

  @Column({ type: 'varchar', length: 128, nullable: true })
  externalPriceId: string | null;

  @Column({ type: 'simple-json', nullable: true })
  metadata: Record<string, unknown> | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
