import { IsIn, IsOptional, IsString } from 'class-validator';
import { AdminPaginationDto } from './admin-pagination.dto';

export class AdminUserQueryDto extends AdminPaginationDto {
  @IsOptional()
  @IsString()
  q?: string;

  @IsOptional()
  @IsIn(['admin', 'candidat', 'employer'])
  role?: 'admin' | 'candidat' | 'employer';

  @IsOptional()
  @IsIn(['active', 'banned'])
  status?: 'active' | 'banned';

  @IsOptional()
  @IsIn(['createdAt', 'email', 'name'])
  sortBy?: 'createdAt' | 'email' | 'name' = 'createdAt';

  @IsOptional()
  @IsIn(['ASC', 'DESC'])
  sortDir?: 'ASC' | 'DESC' = 'DESC';
}
