import { Type } from 'class-transformer';
import { IsDateString, IsIn, IsInt, IsOptional, IsString, Min } from 'class-validator';
import { AdminPaginationDto } from './admin-pagination.dto';

export class AdminCvLibraryQueryDto extends AdminPaginationDto {
  @IsOptional()
  @IsString()
  q?: string;

  @IsOptional()
  @IsString()
  city?: string;

  @IsOptional()
  @IsDateString()
  uploadedFrom?: string;

  @IsOptional()
  @IsDateString()
  uploadedTo?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  candidateUserId?: number;

  @IsOptional()
  @IsIn(['uploadedAt', 'candidateName', 'email'])
  sortBy?: 'uploadedAt' | 'candidateName' | 'email' = 'uploadedAt';

  @IsOptional()
  @IsIn(['ASC', 'DESC'])
  sortDir?: 'ASC' | 'DESC' = 'DESC';
}
