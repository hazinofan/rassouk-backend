import { Type } from 'class-transformer';
import { IsInt, Min } from 'class-validator';

export class AdminSupportAssignDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  adminUserId: number;
}
