import { IsString, MinLength } from 'class-validator';
export class ResetPasswordDto {
  @IsString() token!: string;              // raw token from email
  @IsString() @MinLength(8) password!: string;
}