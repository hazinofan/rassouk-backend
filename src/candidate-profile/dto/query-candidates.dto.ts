import { IsInt, IsOptional, IsIn, IsPositive, IsBooleanString, Min, IsNumber, IsString } from 'class-validator'
import { Type } from 'class-transformer'
import { Gender } from '../entities/candidate-profile.entity'

export class QueryCandidatesDto {
  @IsOptional() q?: string
  @IsOptional() city?: string
  @IsOptional() gender?: Gender
  @IsOptional() nationality?: string
  @IsOptional() @IsBooleanString() onboardingCompleted?: '0'|'1'

  // 🔽 NEW: education/experience filters
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) experienceMin?: number
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) experienceMax?: number

  /** Minimum degree rank to accept: 0 none, 1 secondary, 2 bac/high-school, 3 bac+2, 4 bachelor/licence, 5 master, 6 phd */
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) degreeMinLevel?: number

  /** Fuzzy match inside degree text (e.g. 'informatique', 'cloud', 'bi') */
  @IsOptional() @IsString() degreeIncludes?: string

  @IsOptional() @IsIn(['latest','oldest','name','experience_desc','experience_asc','degree_desc','degree_asc'])
  sort?: 'latest'|'oldest'|'name'|'experience_desc'|'experience_asc'|'degree_desc'|'degree_asc' = 'latest'

  @IsOptional() @Type(() => Number) @IsInt() @IsPositive() page?: number = 1
  @IsOptional() @Type(() => Number) @IsInt() @IsPositive() pageSize?: number = 12
}
