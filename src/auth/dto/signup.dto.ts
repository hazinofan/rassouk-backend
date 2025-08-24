// src/auth/dto/signup.dto.ts
import { IsEmail, IsIn, IsString, MinLength, MaxLength } from 'class-validator';
import { UserRole } from 'src/users/users.entity';

export class SignupDto {
  @IsEmail() email: string;

  @IsString() @MinLength(8) @MaxLength(72)
  password: string;

  @IsIn(['candidat','employer'])
  role: Exclude<UserRole,'admin'>; // users can't self-assign admin
}
