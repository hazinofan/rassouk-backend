import { IsDateString, IsOptional, IsString, MaxLength } from 'class-validator';

export class SendInterviewInvitationDto {
  @IsDateString()
  interviewAt: string;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  message?: string;
}
