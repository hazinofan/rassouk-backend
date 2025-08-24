import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';
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
  passwordHash: string;

  @Column({ default: false })
  emailVerified: boolean;

  @Column({ type: 'enum', enum: ['admin','candidat','employer'], default: 'candidat' })
  role: UserRole;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

