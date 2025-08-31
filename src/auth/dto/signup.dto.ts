// src/auth/dto/signup.dto.ts
export class SignupDto {
  email: string;
  password: string;
  role?: 'candidat' | 'employer' | 'admin';
}
