import { IsIn, IsOptional, IsString } from 'class-validator';
import { AdminPaginationDto } from './admin-pagination.dto';

export class AdminInvoiceQueryDto extends AdminPaginationDto {
  @IsOptional()
  @IsString()
  q?: string;

  @IsOptional()
  @IsIn(['employer', 'candidate'])
  audience?: 'employer' | 'candidate';

  @IsOptional()
  @IsIn(['paid', 'pending', 'void'])
  status?: 'paid' | 'pending' | 'void';

  @IsOptional()
  @IsIn(['issuedAt', 'createdAt', 'amount'])
  sortBy?: 'issuedAt' | 'createdAt' | 'amount' = 'issuedAt';

  @IsOptional()
  @IsIn(['ASC', 'DESC'])
  sortDir?: 'ASC' | 'DESC' = 'DESC';
}
