import { IsInt, IsOptional, IsString, Length, Min, Max } from 'class-validator';

export class CreateEducationDto {
  @IsString() @Length(2, 160)
  degree!: string;

  @IsInt() @Min(1900) @Max(new Date().getFullYear() + 1)
  year!: number;

  @IsOptional() @IsString() @Length(2, 160)
  institution?: string;
}
