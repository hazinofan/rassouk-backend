import { IsInt, IsOptional, IsString } from 'class-validator';

export class TrackViewDto {
  @IsInt()
  jobId: number;

  @IsOptional()
  @IsInt()
  tenantId?: number;

  @IsOptional()
  @IsString()
  sessionId?: string; // anonymous browser id

  @IsOptional()
  @IsString()
  referrer?: string;

  @IsOptional()
  @IsString()
  source?: string; // utm_source or derived ('linkedin', 'google', 'direct', ...)
}
