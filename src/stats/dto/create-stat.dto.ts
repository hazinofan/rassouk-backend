// src/analytics/dto/overview-query.dto.ts
import { IsIn, IsISO8601, IsOptional, IsString } from 'class-validator';
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
}
