import {
  Entity, PrimaryColumn, OneToOne, JoinColumn, Column,
  CreateDateColumn, UpdateDateColumn
} from 'typeorm';
import { User } from 'src/users/users.entity'; 

export enum OrganizationType {
  COMPANY = 'company',
  STARTUP = 'startup',
  AGENCY = 'agency',
  NGO = 'ngo',
  GOVERNMENT = 'government',
  OTHER = 'other',
}

export enum TeamSize {
  S_1_10 = '1-10',
  S_11_50 = '11-50',
  S_51_200 = '51-200',
  S_201_500 = '201-500',
  S_500_PLUS = '500+',
}

@Entity('employer_profiles')
export class EmployerProfile {
  // 1:1 with users; PK = FK
  @PrimaryColumn({ name: 'user_id', type: 'int' })
  userId: number;

  @OneToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  // Media
  @Column({ length: 255, nullable: true })
  logoUrl?: string;

  @Column({ length: 255, nullable: true })
  bannerUrl?: string;

  // Company identity
  @Column({ length: 200 })
  companyName: string;

  @Column({ type: 'text', nullable: true })
  about?: string;

  @Column({ type: 'enum', enum: OrganizationType, default: OrganizationType.COMPANY })
  organizationType: OrganizationType;

  @Column({ length: 100, nullable: true })
  industryType?: string;

  @Column({ type: 'enum', enum: TeamSize, nullable: true })
  teamSize?: TeamSize;

  @Column({ type: 'smallint', nullable: true })
  yearEstablished?: number;

  @Column({ length: 255, nullable: true })
  websiteUrl?: string;

  @Column({ type: 'text', nullable: true })
  vision?: string;

  // Socials
  @Column({ length: 255, nullable: true })
  facebookUrl?: string;

  @Column({ length: 255, nullable: true })
  instagramUrl?: string;

  @Column({ length: 255, nullable: true })
  twitterUrl?: string;

  @Column({ length: 255, nullable: true })
  linkedinUrl?: string;

  // Location
  @Column({ length: 255, nullable: true })
  address?: string;

  @Column({ length: 255, nullable: true })
  city?: string; 

  // Contacts
  @Column({ length: 30, nullable: true })
  companyPhone?: string;

  @Column({ length: 30, nullable: true })
  employerPhone?: string;

  @Column({ length: 255, nullable: true })
  contactEmail?: string;

  // Onboarding flag
  @Column({ type: 'tinyint', default: 0 })
  onboardingCompleted: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
