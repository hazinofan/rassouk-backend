import { IsIn, IsISO8601, IsOptional, IsString, Min, Max, IsInt } from 'class-validator';
import { Transform } from 'class-transformer';

export class EmployerOverviewQueryDto {
  @IsOptional()
  @IsIn(['7d', '30d', '90d', 'custom'])
  range?: '7d' | '30d' | '90d' | 'custom' = '30d';

  @IsOptional()
  @IsISO8601()
  from?: string;

  @IsOptional()
  @IsISO8601()
  to?: string;

  @IsOptional()
  @IsString()
  @Transform(({ value }) => value || 'Africa/Casablanca')
  tz?: string = 'Africa/Casablanca';

  @IsOptional()
  @Transform(({ value }) => (value === undefined ? 1 : Number(value)))
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Transform(({ value }) => (value === undefined ? 30 : Number(value)))
  @IsInt()
  @Min(1)
  @Max(365)
  limit?: number = 30;
}
