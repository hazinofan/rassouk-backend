import { IsEmail, IsOptional, IsString, Length, MinLength } from 'class-validator';

export class AdminCreateAdminUserDto {
  @IsEmail()
  email: string;

  @IsString()
  @Length(2, 120)
  name: string;

  @IsOptional()
  @IsString()
  @MinLength(8)
  password?: string;
}
