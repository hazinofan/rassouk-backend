import { IsDateString, IsOptional, IsString, Length } from 'class-validator';

export class AdminBanUserDto {
  @IsString()
  @Length(3, 500)
  reason: string;

  @IsOptional()
  @IsDateString()
  until?: string;
}
