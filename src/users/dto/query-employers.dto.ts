import { IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class QueryEmployersDto {
  @IsOptional()
  @IsString()
  q?: string;

  @IsOptional()
  @IsString()
  city?: string;

  @IsOptional()
  @IsString()
  industryType?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  jobsMin?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  jobsMax?: number;

  @IsOptional()
  @IsIn(['latest', 'oldest', 'jobs_desc', 'jobs_asc'])
  sort?: 'latest' | 'oldest' | 'jobs_desc' | 'jobs_asc' = 'latest';

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
