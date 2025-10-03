import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SavedCandidate } from './entities/saved_candidate.entity';
import { SavedCandidatesController } from './saved_candidate.controller';
import { SavedCandidatesService } from './saved_candidate.service';
import { AuthModule } from 'src/auth/auth.module';

@Module({
  imports: [TypeOrmModule.forFeature([SavedCandidate]), AuthModule],
  controllers: [SavedCandidatesController],
  providers: [SavedCandidatesService],
})
export class SavedCandidateModule {}
