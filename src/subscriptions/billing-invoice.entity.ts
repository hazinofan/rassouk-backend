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
import type { PlanKey, SubscriptionAudience } from './subscription.types';

export type BillingInvoiceStatus = 'paid' | 'pending' | 'void';

@Entity('billing_invoices')
@Index(['tenant', 'audience', 'issuedAt'])
export class BillingInvoice {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => User, { nullable: false, onDelete: 'CASCADE' })
  tenant: User;

  @Column({
    type: 'enum',
    enum: ['employer', 'candidate'],
  })
  audience: SubscriptionAudience;

  @Column({ type: 'varchar', length: 32 })
  planKey: PlanKey;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 64 })
  invoiceNumber: string;

  @Column({ type: 'varchar', length: 255 })
  description: string;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: '0.00' })
  amount: string;

  @Column({ type: 'varchar', length: 8, default: 'USD' })
  currency: string;

  @Column({
    type: 'enum',
    enum: ['paid', 'pending', 'void'],
    default: 'paid',
  })
  status: BillingInvoiceStatus;

  @Column({ type: 'timestamp', nullable: true })
  periodStart: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  periodEnd: Date | null;

  @Column({ type: 'varchar', length: 64, default: 'sandbox' })
  provider: string;

  @Column({ type: 'varchar', length: 128, nullable: true })
  providerRef: string | null;

  @Column({ type: 'simple-json', nullable: true })
  metadata: Record<string, unknown> | null;

  @Column({ type: 'timestamp', nullable: true })
  paidAt: Date | null;

  @Column({ type: 'datetime' })
  issuedAt: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
