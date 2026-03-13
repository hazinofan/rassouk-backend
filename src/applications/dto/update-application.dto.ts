import { ApplicationStatus } from '../entities/application.entity';
import { IsDateString, IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateApplicationDto {
  @IsEnum(ApplicationStatus)
  status!: ApplicationStatus;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  employerNote?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  rejectionReason?: string;

  @IsOptional()
  @IsDateString()
  interviewAt?: string;
}
