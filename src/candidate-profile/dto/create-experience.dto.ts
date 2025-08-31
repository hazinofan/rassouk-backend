import { IsInt, IsOptional, IsString, Length, Min, Max } from 'class-validator';

export class CreateExperienceDto {
  @IsString() @Length(2, 160)
  title!: string;

  @IsInt() @Min(1900) @Max(new Date().getFullYear() + 1)
  year!: number;

  @IsOptional() @IsString()
  description?: string;
}
