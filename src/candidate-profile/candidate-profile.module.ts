import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CandidateProfile } from './entities/candidate-profile.entity';
import { CandidateExperience } from './entities/candidate-experience.entity';
import { CandidateEducation } from './entities/candidate-education.entity';
import { CandidateResume } from './entities/candidate-resume.entity';
import { CandidateProfilesService } from './candidate-profile.service';
import { CandidateProfilesController } from './candidate-profile.controller';
import { AuthModule } from 'src/auth/auth.module';
import { RolesGuard } from 'src/auth/decorators/roles.guard';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      CandidateProfile,
      CandidateExperience,
      CandidateEducation,
      CandidateResume,
    ]),
    AuthModule, // brings JwtService + JwtAuthGuard (exported)
  ],
  providers: [CandidateProfilesService, RolesGuard],
  controllers: [CandidateProfilesController],
  exports: [CandidateProfilesService],
})
export class CandidateProfilesModule {}
