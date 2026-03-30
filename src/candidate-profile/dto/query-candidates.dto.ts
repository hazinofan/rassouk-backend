import {
  IsInt,
  IsOptional,
  IsIn,
  IsPositive,
  IsBooleanString,
  Min,
  IsNumber,
  IsString,
  IsArray,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { Gender } from '../entities/candidate-profile.entity';

export class QueryCandidatesDto {
  @IsOptional()
  q?: string;

  @IsOptional()
  city?: string;

  @IsOptional()
  gender?: Gender;

  @IsOptional()
  nationality?: string;

  @IsOptional()
  @IsBooleanString()
  onboardingCompleted?: '0' | '1';

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  experienceMin?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  experienceMax?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  degreeMinLevel?: number;

  @IsOptional()
  @IsString()
  degreeIncludes?: string;

  @IsOptional()
  @Transform(({ value }) => {
    if (Array.isArray(value)) return value;
    if (typeof value === 'string') return [value];
    return [];
  })
  @IsArray()
  @IsString({ each: true })
  experienceBuckets?: string[];

  @IsOptional()
  @Transform(({ value }) => {
    if (Array.isArray(value)) return value;
    if (typeof value === 'string') return [value];
    return [];
  })
  @IsArray()
  @IsString({ each: true })
  educations?: string[];

  @IsOptional()
  @IsIn([
    'latest',
    'oldest',
    'name',
    'experience_desc',
    'experience_asc',
    'degree_desc',
    'degree_asc',
  ])
  sort?:
    | 'latest'
    | 'oldest'
    | 'name'
    | 'experience_desc'
    | 'experience_asc'
    | 'degree_desc'
    | 'degree_asc' = 'latest';

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  pageSize?: number = 12;
}