import { IsIn, IsInt, IsOptional, IsString, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { AdminPaginationDto } from './admin-pagination.dto';

export class AdminJobQueryDto extends AdminPaginationDto {
  @IsOptional()
  @IsString()
  q?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  employerId?: number;

  @IsOptional()
  @IsIn(['DRAFT', 'ACTIVE', 'EXPIRED'])
  status?: 'DRAFT' | 'ACTIVE' | 'EXPIRED';

  @IsOptional()
  @IsIn(['createdAt', 'updatedAt', 'title'])
  sortBy?: 'createdAt' | 'updatedAt' | 'title' = 'createdAt';

  @IsOptional()
  @IsIn(['ASC', 'DESC'])
  sortDir?: 'ASC' | 'DESC' = 'DESC';
}
