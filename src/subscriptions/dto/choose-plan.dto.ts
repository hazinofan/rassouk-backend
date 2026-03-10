import { IsIn } from 'class-validator';

export class ChoosePlanDto {
  @IsIn(['free', 'basic', 'standard', 'premium', 'starter', 'pro', 'elite'])
  planKey: 'free' | 'basic' | 'standard' | 'premium' | 'starter' | 'pro' | 'elite';
}
