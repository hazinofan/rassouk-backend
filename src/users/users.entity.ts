import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
// src/users/user.entity.ts
export type UserRole = 'admin' | 'candidat' | 'employer';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn()
  id: number;

  @Index({ unique: true })
  @Column({ length: 255 })
  email: string;

  @Column()
  name: string;

  @Column()
  passwordHash: string;

  @Column({ default: false })
  emailVerified: boolean;

  @Column({ type: 'varchar', length: 255, nullable: true })
  refreshTokenHash?: string | null;

  @Column({
    type: 'enum',
    enum: ['admin', 'candidat', 'employer'],
    default: 'candidat',
  })
  role: UserRole;

  @Column({ type: 'int', default: 0 })
  onboardingStep: number;

  @Column({ type: 'boolean', default: false })
  isOnboarded: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
