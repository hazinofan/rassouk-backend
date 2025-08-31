import {
  IsOptional, IsString, Length, IsEnum, IsEmail, IsUrl,
  IsDateString
} from 'class-validator';
import { Gender, MaritalStatus } from '../entities/candidate-profile.entity';

export class UpsertCandidateProfileDto {
  @IsOptional() @IsString() @Length(1, 255)
  photoPath?: string;

  @IsString() @Length(2, 120)
  firstName!: string;

  @IsString() @Length(2, 120)
  lastName!: string;

  @IsOptional() @IsString() @Length(2, 160)
  headline?: string;

  @IsOptional() @IsString() @Length(2, 100)
  city?: string;

  @IsOptional() @IsString() @Length(5, 30)
  phone?: string;

  @IsOptional() @IsEmail()
  contactEmail?: string;

  @IsOptional() @IsUrl()
  websiteUrl?: string;

  @IsOptional() @IsUrl() facebookUrl?: string;
  @IsOptional() @IsUrl() instagramUrl?: string;
  @IsOptional() @IsUrl() twitterUrl?: string;
  @IsOptional() @IsUrl() linkedinUrl?: string;
  @IsOptional() @IsUrl() githubUrl?: string;

  @IsOptional() @IsString() @Length(2, 100)
  nationality?: string;

  @IsOptional() @IsDateString()
  birthDate?: string;

  @IsOptional() @IsEnum(Gender)
  gender?: Gender;

  @IsOptional() @IsEnum(MaritalStatus)
  maritalStatus?: MaritalStatus;

  @IsOptional() @IsString()
  biography?: string;

  @IsOptional()
  onboardingCompleted?: boolean;
}
