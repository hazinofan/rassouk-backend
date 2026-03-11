import { IsString, Length } from 'class-validator';

export class CreateBlogCategoryDto {
  @IsString()
  @Length(2, 120)
  name: string;
}
