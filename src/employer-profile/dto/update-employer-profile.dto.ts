import { PartialType } from '@nestjs/mapped-types';
import { UpsertEmployerProfileDto } from './create-employer-profile.dto';

export class UpdateEmployerProfileDto extends PartialType(UpsertEmployerProfileDto) {}
