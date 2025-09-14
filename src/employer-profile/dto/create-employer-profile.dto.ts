import {
  IsOptional, IsString, IsEnum, IsUrl, IsInt, Min, Max,
  IsNumber, IsEmail, Length
} from 'class-validator';
import { OrganizationType, TeamSize } from '../entities/employer-profile.entity';

export class UpsertEmployerProfileDto {
  // media
  @IsOptional() @IsUrl() logoUrl?: string;
  @IsOptional() @IsUrl() bannerUrl?: string;

  // identity
  @IsString() @Length(2, 200)
  companyName!: string;

  @IsOptional() @IsString()
  about?: string;

  @IsOptional() @IsEnum(OrganizationType)
  organizationType?: OrganizationType;

  @IsOptional() @IsString() @Length(2, 100)
  industryType?: string;

  @IsOptional() @IsEnum(TeamSize)
  teamSize?: TeamSize;

  @IsOptional() @IsInt() @Min(1900) @Max(new Date().getFullYear())
  yearEstablished?: string;

  @IsOptional() @IsUrl()
  websiteUrl?: string;

  @IsOptional() @IsString()
  vision?: string;

  // socials
  @IsOptional() @IsUrl() facebookUrl?: string;
  @IsOptional() @IsUrl() instagramUrl?: string;
  @IsOptional() @IsUrl() twitterUrl?: string;
  @IsOptional() @IsUrl() linkedinUrl?: string;

  // location
  @IsOptional() @IsString()
  address?: string;

  @IsOptional() @IsNumber({ maxDecimalPlaces: 6 }) @Min(-90) @Max(90)
  latitude?: number;

  @IsOptional() @IsNumber({ maxDecimalPlaces: 6 }) @Min(-180) @Max(180)
  longitude?: number;

  @IsOptional() @IsUrl()
  mapUrl?: string;

  // contacts
  @IsOptional() @IsString() @Length(5, 30)
  companyPhone?: string;

  @IsOptional() @IsString() @Length(5, 30)
  employerPhone?: string;

  @IsOptional() @IsEmail()
  contactEmail?: string;

  // onboarding (let frontend flip it when rea dy)
  @IsOptional()
  onboardingCompleted?: boolean;
}
