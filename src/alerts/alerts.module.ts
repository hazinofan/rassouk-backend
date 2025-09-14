// src/job-alerts/job-alerts.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Job } from 'src/jobs/entities/job.entity';
import { MailService } from 'src/mail/mail.service';
import { JobAlert } from './entities/alert.entity';
import { JobAlertDigestItem } from './entities/job-alert-digest-item.entity';
import { JobAlertsService } from './alerts.service';
import { JobAlertsController } from './alerts.controller';
import { AuthModule } from 'src/auth/auth.module';
import { CandidateProfile } from 'src/candidate-profile/entities/candidate-profile.entity';

@Module({
  imports: [TypeOrmModule.forFeature([JobAlert, JobAlertDigestItem, Job, CandidateProfile]), AuthModule],
  providers: [JobAlertsService, MailService],
  controllers: [JobAlertsController],
  exports: [JobAlertsService],
})
export class JobAlertsModule {}
