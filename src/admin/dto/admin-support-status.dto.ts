import { IsIn } from 'class-validator';

export class AdminSupportStatusDto {
  @IsIn(['open', 'in_progress', 'resolved', 'closed'])
  status: 'open' | 'in_progress' | 'resolved' | 'closed';
}
