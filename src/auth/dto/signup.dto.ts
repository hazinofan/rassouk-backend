// signup.dto.ts
import { IsEmail, IsString, MinLength, IsIn, IsNotEmpty } from 'class-validator';

export class SignupDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(6)
  password!: string;

  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsString()
  @IsIn(['candidat', 'employer', 'admin'])
  role!: 'candidat' | 'employer' | 'admin';
}
  