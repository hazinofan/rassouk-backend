import { PartialType } from '@nestjs/mapped-types';
import { CreateJobBookmarkDto } from './create-job-bookmark.dto';

export class UpdateJobBookmarkDto extends PartialType(CreateJobBookmarkDto) {}
