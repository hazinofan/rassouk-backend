import { IsOptional, IsString, Length } from 'class-validator';

export class AddResumeDto {
  @IsString() @Length(3, 255)
  filePath!: string; // already saved under /public

  @IsOptional() @IsString() @Length(1, 160)
  label?: string;
}
