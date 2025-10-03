import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Job } from '../jobs/entities/job.entity';
import { Application } from '../applications/entities/application.entity';
import { JobClickEvent } from './entities/job-click-event.entity';
import { JobViewEvent } from './entities/stat.entity';
import { CacheModule } from '@nestjs/cache-manager';
import { AnalyticsService } from './stats.service';
import { AnalyticsController } from './stats.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([Job, Application, JobViewEvent, JobClickEvent]),
    CacheModule.register({
      ttl: 60, // seconds
      isGlobal: false,
    }),
  ],
  controllers: [AnalyticsController],
  providers: [AnalyticsService],
  exports: [AnalyticsService],
})
export class AnalyticsModule {}
