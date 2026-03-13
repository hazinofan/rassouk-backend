import { IsOptional, IsString, MaxLength } from 'class-validator';

export class SendRejectionMessageDto {
  @IsString()
  @MaxLength(255)
  rejectionReason: string;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  message?: string;
}
