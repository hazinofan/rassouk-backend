// src/applications/dto/create-application.dto.ts
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString } from 'class-validator';
export class CreateApplicationDto {
  @IsOptional() @IsString() coverLetter?: string;
  @IsOptional() @IsString() source?: string; 
  @IsOptional() @Type(() => Number) @IsInt() employerId?: number; 
}
