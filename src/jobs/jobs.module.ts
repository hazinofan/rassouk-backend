// src/jobs/jobs.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JobsService } from './jobs.service';
import { JobsController } from './jobs.controller';
import { Job } from './entities/job.entity';
import { AuthModule } from 'src/auth/auth.module';
import { SubscriptionsModule } from 'src/subscriptions/subscriptions.module';

@Module({
  imports: [TypeOrmModule.forFeature([Job]), AuthModule, SubscriptionsModule],
  controllers: [JobsController],
  providers: [JobsService],
  exports: [JobsService], 
})
export class JobsModule {}
