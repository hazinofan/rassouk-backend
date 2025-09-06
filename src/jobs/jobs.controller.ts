// src/jobs/jobs.controller.ts
import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JobsService } from './jobs.service';
import { CreateJobDto } from './dto/create-job.dto';
import { UpdateJobDto } from './dto/update-job.dto';
import { QueryJobDto } from './dto/query-job.dto';
import { JwtAuthGuard } from 'src/auth/guards/jwt.guard';
import { RolesGuard } from 'src/auth/decorators/roles.guard';
import { Roles } from 'src/auth/decorators/roles.decorator';
import { CurrentUser } from 'src/auth/decorators/current-user.decoratoe';
import { UpdateJobStatusDto } from './dto/update-job-status.dto';
import { JobStatus } from './entities/job.entity';
@Controller('jobs')
export class JobsController {
  constructor(private readonly jobs: JobsService) {}

  // Public endpoints
  @Get()
  findPublic(@Query() qs: QueryJobDto) {
    return this.jobs.findPublic(qs);
  }

  @Get('slug/:slug')
  findOneBySlug(@Param('slug') slug: string) {
    return this.jobs.findOneBySlug(slug);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('employer')
  @Patch(':id/status')
  async updateStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateJobStatusDto,
    @Req() req: any,
  ) {
    const employerId = req.user.id;
    return this.jobs.updateStatus(id, employerId, dto.status as JobStatus);
  }

  // Employer endpoints
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('employer')
  @Post()
  create(@Body() dto: CreateJobDto, @CurrentUser() user: any) {
    return this.jobs.create(dto, user.id);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('employer')
  @Get('me')
  findMine(
    @CurrentUser() user: any,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.jobs.findMine(user.id, Number(page) || 1, Number(limit) || 20);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('employer')
  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateJobDto,
    @CurrentUser() user: any,
  ) {
    return this.jobs.update(Number(id), user.id, dto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('employer')
  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser() user: any) {
    return this.jobs.softDelete(Number(id), user.id);
  }
}
