import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayNotEmpty,
  IsArray,
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import { ApplicationStatus } from '../entities/application.entity';

export class BulkUpdateApplicationStatusDto {
  @IsArray()
  @ArrayNotEmpty()
  @ArrayMaxSize(200)
  @Type(() => Number)
  @IsInt({ each: true })
  @Min(1, { each: true })
  applicationIds: number[];

  @IsEnum(ApplicationStatus)
  status: ApplicationStatus;

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
