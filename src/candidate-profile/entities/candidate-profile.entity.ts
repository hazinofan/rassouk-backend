import {
  Entity, PrimaryColumn, OneToOne, JoinColumn, Column,
  CreateDateColumn, UpdateDateColumn, OneToMany
} from 'typeorm';
import { User } from 'src/users/users.entity';
import { CandidateExperience } from './candidate-experience.entity';
import { CandidateEducation } from './candidate-education.entity';
import { CandidateResume } from './candidate-resume.entity';

export enum Gender {
  MALE = 'male',
  FEMALE = 'female',
  OTHER = 'other',
  UNSPECIFIED = 'unspecified',
}

export enum MaritalStatus {
  SINGLE = 'single',
  MARRIED = 'married',
  DIVORCED = 'divorced',
  WIDOWED = 'widowed',
}

@Entity('candidate_profiles')
export class CandidateProfile {
  // 1:1 with users; PK = FK
  @PrimaryColumn({ name: 'user_id', type: 'int' })
  userId: number;

  @OneToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  // Media
  @Column({ length: 255, nullable: true })
  photoPath?: string; // path in /public

  // Identity
  @Column({ length: 120 })
  firstName: string;

  @Column({ length: 120 })
  lastName: string;

  @Column({ length: 160, nullable: true })
  headline?: string;

  // Contact
  @Column({ length: 100, nullable: true })
  city?: string;

  @Column({ length: 30, nullable: true })
  phone?: string;

  @Column({ length: 255, nullable: true })
  contactEmail?: string; // can mirror users.email or be custom

  @Column({ length: 255, nullable: true })
  websiteUrl?: string;

  // Socials
  @Column({ length: 255, nullable: true })
  facebookUrl?: string;
  @Column({ length: 255, nullable: true })
  instagramUrl?: string;
  @Column({ length: 255, nullable: true })
  twitterUrl?: string;
  @Column({ length: 255, nullable: true })
  linkedinUrl?: string;
  @Column({ length: 255, nullable: true })
  githubUrl?: string;

  // Personal info
  @Column({ length: 100, nullable: true })
  nationality?: string;

  @Column({ type: 'date', nullable: true })
  birthDate?: string;

  @Column({ type: 'enum', enum: Gender, default: Gender.UNSPECIFIED })
  gender: Gender;

  @Column({ type: 'enum', enum: MaritalStatus, nullable: true })
  maritalStatus?: MaritalStatus;

  @Column({ type: 'text', nullable: true })
  biography?: string;

  // Onboarding
  @Column({ type: 'tinyint', default: 0 })
  onboardingCompleted: boolean;

  // Relations
  @OneToMany(() => CandidateExperience, (e) => e.profile, { cascade: true })
  experiences: CandidateExperience[];

  @OneToMany(() => CandidateEducation, (e) => e.profile, { cascade: true })
  educations: CandidateEducation[];

  @OneToMany(() => CandidateResume, (r) => r.profile, { cascade: true })
  resumes: CandidateResume[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
