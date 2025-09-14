// src/job-alerts/dto/update-job-alert.dto.ts
import { PartialType } from '@nestjs/mapped-types';
import { CreateJobAlertDto } from './create-alert.dto';

export class UpdateJobAlertDto extends PartialType(CreateJobAlertDto) {}
