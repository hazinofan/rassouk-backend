import { IsEmail, IsString, Length } from 'class-validator';

export class SendSupportMessageDto {
  @IsEmail()
  email: string;

  @IsString()
  @Length(3, 120)
  title: string;

  @IsString()
  @Length(10, 5000)
  message: string;
}
