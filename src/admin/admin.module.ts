import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from 'src/auth/auth.module';
import { Job } from 'src/jobs/entities/job.entity';
import { MailModule } from 'src/mail/mail.module';
import { BillingInvoice } from 'src/subscriptions/billing-invoice.entity';
import { Subscription } from 'src/subscriptions/subscription.entity';
import { SupportMessage } from 'src/support/entities/support-message.entity';
import { User } from 'src/users/users.entity';
import { AdminAuditService } from './admin-audit.service';
import { AdminBillingController } from './admin-billing.controller';
import { AdminBillingService } from './admin-billing.service';
import { AdminJobsController } from './admin-jobs.controller';
import { AdminJobsService } from './admin-jobs.service';
import { AdminSupportController } from './admin-support.controller';
import { AdminSupportService } from './admin-support.service';
import { AdminUsersController } from './admin-users.controller';
import { AdminUsersService } from './admin-users.service';
import { AdminAuditLog } from './entities/admin-audit-log.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      User,
      Job,
      SupportMessage,
      Subscription,
      BillingInvoice,
      AdminAuditLog,
    ]),
    AuthModule,
    MailModule,
  ],
  controllers: [
    AdminUsersController,
    AdminJobsController,
    AdminSupportController,
    AdminBillingController,
  ],
  providers: [
    AdminUsersService,
    AdminJobsService,
    AdminSupportService,
    AdminBillingService,
    AdminAuditService,
  ],
})
export class AdminModule {}
