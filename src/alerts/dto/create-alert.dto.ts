// src/job-alerts/dto/create-job-alert.dto.ts
import { IsOptional, IsString, IsBoolean, IsInt, Min, IsArray } from 'class-validator';

export class CreateJobAlertDto {
  @IsOptional() @IsString() keyword?: string;
  @IsOptional() @IsString() location_city?: string;
  @IsOptional() @IsString() location_country?: string;
  @IsOptional() @IsString() job_type?: string;
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];
  @IsOptional() @IsString() industry?: string;
  @IsOptional() @IsString() experience_level?: string;
  @IsOptional() @IsInt() @Min(0) min_salary?: number;
  @IsOptional() @IsBoolean() is_active?: boolean;
}
