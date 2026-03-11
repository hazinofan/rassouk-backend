import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from 'src/users/users.entity';

export type SupportMessageStatus = 'open' | 'in_progress' | 'resolved' | 'closed';

@Entity('support_messages')
export class SupportMessage {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => User, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column()
  userId: number;

  @Column({ length: 255 })
  email: string;

  @Column({ length: 120 })
  title: string;

  @Column({ type: 'text' })
  message: string;

  @Column({
    type: 'enum',
    enum: ['open', 'in_progress', 'resolved', 'closed'],
    default: 'open',
  })
  status: SupportMessageStatus;

  @Column({
    type: 'enum',
    enum: ['low', 'normal', 'high'],
    default: 'normal',
  })
  priority: 'low' | 'normal' | 'high';

  @Column({ type: 'int', nullable: true })
  assignedToUserId: number | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'assignedToUserId' })
  assignedTo: User | null;

  @Column({ type: 'timestamp', nullable: true })
  resolvedAt: Date | null;

  @Column({ type: 'int', nullable: true })
  resolvedByUserId: number | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
