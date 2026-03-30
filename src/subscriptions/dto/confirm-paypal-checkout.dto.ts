import { IsOptional, IsString } from 'class-validator';

export class ConfirmPaypalCheckoutDto {
  @IsOptional()
  @IsString()
  subscriptionId?: string;

  @IsOptional()
  @IsString()
  token?: string;
}
