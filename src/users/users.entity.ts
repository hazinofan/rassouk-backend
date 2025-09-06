import { EmployerProfile } from 'src/employer-profile/entities/employer-profile.entity';
import { Job } from 'src/jobs/entities/job.entity';
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  OneToMany,
  JoinColumn,
  OneToOne,
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

  @Column()
  emailVerified: boolean;

  @Column({ type: 'varchar', length: 255, nullable: true ,select: false })
  refreshTokenHash?: string | null;

  @Column({
    type: 'enum',
    enum: ['admin', 'candidat', 'employer'],
    default: 'candidat',
  })
  role: UserRole;

  @OneToMany(() => Job, (job) => job.employer)
  jobs: Job[];

  @OneToOne(() => EmployerProfile, (p) => p.user, { nullable: true })
  profile?: EmployerProfile;

  @Column({ type: 'int', default: 0 })
  onboardingStep: number; 

  @Column({ type: 'boolean', default: false })
  isOnboarded: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
