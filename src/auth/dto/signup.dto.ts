// src/auth/dto/signup.dto.ts
export class SignupDto {
  email: string;
  name: string
  password: string;
  role?: 'candidat' | 'employer' | 'admin';
}
