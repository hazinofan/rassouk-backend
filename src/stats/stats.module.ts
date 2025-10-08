import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Job } from '../jobs/entities/job.entity';
import { Application } from '../applications/entities/application.entity';
import { JobClickEvent } from './entities/job-click-event.entity';
import { JobViewEvent } from './entities/stat.entity';
import { CacheModule } from '@nestjs/cache-manager';
import { AnalyticsService } from './stats.service';
import { StatsController } from './stats.controller';
import { TrackController } from './track.controller';
import { JobEvent } from './entities/job-view-event.entity';
import { StatsSeriesController } from './stats-series.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([Job, Application,JobViewEvent, JobEvent, JobClickEvent]),
    CacheModule.register({
      ttl: 60, // seconds
      isGlobal: false,
    }),
  ],
  controllers: [StatsController, TrackController, StatsSeriesController],
  providers: [AnalyticsService],
  exports: [AnalyticsService],
})
export class AnalyticsModule {}
