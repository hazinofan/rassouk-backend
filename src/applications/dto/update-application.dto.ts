import { PartialType } from '@nestjs/mapped-types';
import { CreateApplicationDto } from './create-application.dto';
import { ApplicationStatus } from '../entities/application.entity';
import { IsEnum } from 'class-validator';

export class UpdateApplicationDto {
     @IsEnum(ApplicationStatus)
  status!: ApplicationStatus;
}
