import {
  IsEnum, IsInt, IsOptional, IsPositive, IsString, IsArray,
  MaxLength, IsDate, Min
} from 'class-validator';
import { Type } from 'class-transformer';
import { JobLevel, JobType, SalaryType } from '../entities/job.entity';

export class CreateJobDto {
  @IsString() @MaxLength(180)
  title: string;

  @IsOptional() @IsString()
  description?: string;

  @IsOptional() @IsString()
  responsibilities?: string;

  @IsOptional() @IsArray()
  tags?: string[];

  @IsOptional() @IsString() @MaxLength(120)
  role?: string;

  @IsOptional() @Type(() => Number) @IsInt() @Min(0)
  minSalary?: number;

  @IsOptional() @Type(() => Number) @IsInt() @Min(0)
  maxSalary?: number;

  @IsOptional() @IsEnum(SalaryType)
  salaryType?: SalaryType;

  @IsOptional() @IsEnum(JobType)
  jobType?: JobType;

  @IsOptional() @IsEnum(JobLevel)
  jobLevel?: JobLevel;

  @IsOptional() @IsString()
  education?: string;

  @IsOptional() @IsString()
  experience?: string;

  @IsOptional() @Type(() => Number) @IsInt() @IsPositive()
  vacancies?: number;

  @IsOptional() @IsString() @MaxLength(3)
  currency?: string;

  @IsOptional() @IsString()
  location?: string;

  @IsOptional() @Type(() => Date) @IsDate()
  expiresAt?: Date; // now a Date, not string
}
