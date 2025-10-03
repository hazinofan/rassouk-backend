import { PartialType } from '@nestjs/mapped-types';
import { CreateSavedCandidateDto } from './create-saved_candidate.dto';

export class UpdateSavedCandidateDto extends PartialType(CreateSavedCandidateDto) {}
