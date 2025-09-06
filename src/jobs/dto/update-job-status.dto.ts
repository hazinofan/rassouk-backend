import { IsEnum } from 'class-validator';
import { JobStatus } from '../entities/job.entity';

export class UpdateJobStatusDto {
  @IsEnum(JobStatus)
  status!: JobStatus;
}
