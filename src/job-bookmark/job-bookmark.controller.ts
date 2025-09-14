// src/job-bookmarks/job-bookmarks.controller.ts
import {
  Controller, Post, Delete, Get, Param, ParseIntPipe, UseGuards, Req, BadRequestException,
} from '@nestjs/common';
import { JwtAuthGuard } from 'src/auth/guards/jwt.guard';
import { JobBookmarksService } from './job-bookmark.service';

@UseGuards(JwtAuthGuard)
@Controller()
export class JobBookmarksController {
  constructor(private readonly svc: JobBookmarksService) {}

  private getUserId(req: any): number {
    // Support common shapes: { id }, { sub }, { userId }
    const raw = req?.user?.id ?? req?.user?.sub ?? req?.user?.userId;
    const uid = Number(raw);
    if (!Number.isFinite(uid) || uid <= 0) {
      throw new BadRequestException('Invalid authenticated user id.');
    }
    return uid;
  }

  @Post('jobs/:jobId/bookmark')
  add(@Param('jobId', ParseIntPipe) jobId: number, @Req() req: any) {
    const userId = this.getUserId(req);
    return this.svc.add(userId, jobId);
  }

  @Delete('jobs/:jobId/bookmark')
  remove(@Param('jobId', ParseIntPipe) jobId: number, @Req() req: any) {
    const userId = this.getUserId(req);
    return this.svc.remove(userId, jobId);
  }

  @Get('jobs/:jobId/bookmark')
  async is(@Param('jobId', ParseIntPipe) jobId: number, @Req() req: any) {
    const userId = this.getUserId(req);
    const bookmarked = await this.svc.isBookmarked(userId, jobId);
    return { bookmarked };
  }

  @Get('me/bookmarks')
  mine(@Req() req: any) {
    const userId = this.getUserId(req);
    return this.svc.listMine(userId);
  }
}
