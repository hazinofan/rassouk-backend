import {
  IsInt,
  IsOptional,
  IsString,
  Length,
  Min,
  Max,
  ValidateIf,
} from 'class-validator';

export class CreateExperienceDto {
  @IsString() @Length(2, 160)
  title!: string;

  @IsInt() @Min(1900) @Max(new Date().getFullYear() + 1)
  fromYear!: number;

  @ValidateIf((_, value) => value !== null && value !== undefined)
  @IsInt() @Min(1900) @Max(new Date().getFullYear() + 1)
  toYear?: number | null;

  @IsOptional() @IsString()
  description?: string;
}
