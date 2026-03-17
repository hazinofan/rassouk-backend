import { CacheModule } from '@nestjs/cache-manager';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { JwtAuthGuard } from 'src/auth/guards/jwt.guard';
import { Application } from 'src/applications/entities/application.entity'; 
import { CandidateResume } from 'src/candidate-profile/entities/candidate-resume.entity';
import { JobBookmark } from 'src/job-bookmark/entities/job-bookmark.entity'; 
import { Job } from 'src/jobs/entities/job.entity';
import { SavedCandidate } from 'src/saved_candidate/entities/saved_candidate.entity';
import { User } from 'src/users/users.entity';
import { BillingInvoice } from './billing-invoice.entity';
import { BillingProviderPlan } from './billing-provider-plan.entity'; 
import { InvoicePdfService } from './invoice-pdf.service';
import { SubscriptionEvent } from './subscription-events.entity';
import { Subscription } from './subscription.entity';
import { SubscriptionsController } from './subscriptions.controller';
import { EntitlementsService } from './entitlements.service';
import { JobRefreshEvent } from 'src/jobs/entities/job-refresh-event.entity';
import { BillingCheckoutService } from './billing-checkout.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Subscription,
      SubscriptionEvent,
      BillingInvoice,
      BillingProviderPlan,
      User,
      Job,
      JobRefreshEvent,
      SavedCandidate,
      BillingProviderPlan,
      Application,
      JobBookmark,
      CandidateResume,
      JobRefreshEvent,
    ]),
    CacheModule.register({
      ttl: 30,
      isGlobal: false,
    }),
    JwtModule.register({}),
  ],
  controllers: [SubscriptionsController],
  providers: [
  EntitlementsService,
  InvoicePdfService,
  BillingCheckoutService,
  JwtAuthGuard,
  ],
  exports: [EntitlementsService],
})
export class SubscriptionsModule {}
