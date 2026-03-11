import { Module } from '@nestjs/common';
import { ApplicationsService } from './applications.service';
import { ApplicationsController } from './applications.controller';
import { RolesGuard } from 'src/auth/decorators/roles.guard';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Application } from './entities/application.entity';
import { Job } from 'src/jobs/entities/job.entity';
import { CandidateProfile } from 'src/candidate-profile/entities/candidate-profile.entity';
import { AuthModule } from 'src/auth/auth.module';
import { MailModule } from 'src/mail/mail.module';
import { SubscriptionsModule } from 'src/subscriptions/subscriptions.module';
import { NotificationsModule } from 'src/notifications/notifications.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Application, Job, CandidateProfile]),
    AuthModule,
    MailModule,
    SubscriptionsModule,
    NotificationsModule,
  ],
  controllers: [ApplicationsController],
  providers: [ApplicationsService, RolesGuard],
  exports: [ApplicationsService]
})
export class ApplicationsModule {}
