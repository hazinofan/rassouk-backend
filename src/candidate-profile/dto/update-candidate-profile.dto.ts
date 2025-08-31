import { PartialType } from '@nestjs/mapped-types';
import { UpsertCandidateProfileDto } from './upsert-candidate-profile.dto';

export class UpdateCandidateProfileDto extends PartialType(UpsertCandidateProfileDto) {}
