// src/job-bookmarks/job-bookmarks.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Job } from 'src/jobs/entities/job.entity';
import { JobBookmark } from './entities/job-bookmark.entity';
import { JobBookmarksController } from './job-bookmark.controller';
import { JobBookmarksService } from './job-bookmark.service';
import { AuthModule } from 'src/auth/auth.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([JobBookmark, Job]),
    AuthModule
  ],
  controllers: [JobBookmarksController],
  providers: [JobBookmarksService],
  exports: [JobBookmarksService],
})
export class JobBookmarksModule {}
