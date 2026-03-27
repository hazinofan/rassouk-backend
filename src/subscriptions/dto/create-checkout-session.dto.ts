import { IsIn, IsOptional, IsString, IsUrl } from 'class-validator';

export class CreateCheckoutSessionDto {
  @IsIn(['free', 'basic', 'standard', 'premium', 'starter', 'pro', 'elite'])
  planKey:
    | 'free'
    | 'basic'
    | 'standard'
    | 'premium'
    | 'starter'
    | 'pro'
    | 'elite';

  @IsOptional()
  @IsIn(['paypal'])
  provider?: 'paypal';

  @IsOptional()
  @IsUrl({
    require_tld: false,
    require_protocol: true,
  })
  successUrl?: string;

  @IsOptional()
  @IsUrl({
    require_tld: false,
    require_protocol: true,
  })
  cancelUrl?: string;

  @IsOptional()
  @IsString()
  locale?: string;
}
