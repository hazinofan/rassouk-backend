import { IsIn, IsOptional, IsString } from 'class-validator';
import { AdminPaginationDto } from './admin-pagination.dto';

export class AdminSubscriptionQueryDto extends AdminPaginationDto {
  @IsOptional()
  @IsString()
  q?: string;

  @IsOptional()
  @IsIn(['employer', 'candidate'])
  audience?: 'employer' | 'candidate';

  @IsOptional()
  @IsIn(['active', 'canceled', 'inactive', 'past_due', 'trialing'])
  status?: 'active' | 'canceled' | 'inactive' | 'past_due' | 'trialing';

  @IsOptional()
  @IsIn(['createdAt', 'updatedAt', 'currentPeriodEnd'])
  sortBy?: 'createdAt' | 'updatedAt' | 'currentPeriodEnd' = 'updatedAt';

  @IsOptional()
  @IsIn(['ASC', 'DESC'])
  sortDir?: 'ASC' | 'DESC' = 'DESC';
}
