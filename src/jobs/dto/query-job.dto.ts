// query-job.dto.ts
import { Transform, Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import { JobLevel, JobType } from '../entities/job.entity';

const csvOrUndef = (value: unknown) =>
  value == null || value === ''
    ? undefined
    : String(value)
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);

const boolOrUndef = (value: unknown) =>
  value === true || String(value).toLowerCase() === 'true'
    ? true
    : value == null || value === ''
      ? undefined
      : false;

export class QueryJobDto {
  @IsOptional() @IsString() q?: string;
  @IsOptional() @IsString() role?: string;
  @IsOptional() @IsString() location?: string;

  // single type
  @IsOptional() @IsString() type?: string;

  // multi types
  @IsOptional()
  @Transform(({ value }) => csvOrUndef(value))
  @IsArray()
  types?: string[];

  @IsOptional()
  @Transform(({ value }) => value as JobType)
  jobType?: JobType;

  // EXP
  @IsOptional() @IsString() exp?: string;

  // Salary label
  @IsOptional() @IsString() salary?: string;

  // Level
  @IsOptional()
  @IsIn(['JUNIOR', 'MID', 'SENIOR', 'LEAD'])
  level?: JobLevel;

@IsOptional()
@Transform(({ value }) => {
  if (Array.isArray(value)) return value;        // keep ?education[]=...
  if (value == null || value === '') return undefined;
  return String(value)
    .split(',')                                   // support CSV too
    .map(s => s.trim())
    .filter(Boolean);
})
@IsArray()
education?: string[];

  // NEW: tags CSV (e.g. "react,vue,tailwind")
  @IsOptional()
  @Transform(({ value }) => csvOrUndef(value))
  @IsArray()
  tags?: string[];

  // remoteOnly
  @IsOptional()
  @Transform(({ value }) => boolOrUndef(value))
  @IsBoolean()
  remote?: boolean;

  @IsOptional()
  @IsIn(['new', 'latest', 'oldest', 'salary'])
  sort?: 'new' | 'latest' | 'oldest' | 'salary' = 'new';

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;
}
