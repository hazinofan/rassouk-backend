// applications/dto/query-applications.dto.ts
import {
  IsArray,
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { ApplicationStatus } from '../entities/application.entity';

export class QueryApplicationsDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1)
  page?: number = 1;

  @IsOptional() @Type(() => Number) @IsInt() @Min(1)
  limit?: number = 20;

  @IsOptional() @IsString()
  q?: string; 

  @IsOptional()
  @Transform(({ value }) => {
    if (Array.isArray(value)) return value;
    if (value == null || value === '') return undefined;
    return String(value)
      .split(',')
      .map((v) => v.trim())
      .filter(Boolean);
  })
  @IsArray()
  @IsEnum(ApplicationStatus, { each: true })
  status?: ApplicationStatus[];

  @IsOptional()
  @IsDateString()
  appliedFrom?: string;

  @IsOptional()
  @IsDateString()
  appliedTo?: string;
}
