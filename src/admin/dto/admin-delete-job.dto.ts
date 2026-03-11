import { IsString, Length } from 'class-validator';

export class AdminDeleteJobDto {
  @IsString()
  @Length(3, 1000)
  reason: string;
}
