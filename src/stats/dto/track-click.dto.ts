import { IsInt, IsOptional, IsString } from 'class-validator';

export class TrackClickDto {
  @IsInt()
  jobId: number;

  @IsOptional()
  @IsInt()
  tenantId?: number;

  @IsOptional()
  @IsString()
  sessionId?: string;

  @IsOptional()
  @IsString()
  source?: string;
}
