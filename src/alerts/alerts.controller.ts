// src/job-alerts/job-alerts.controller.ts
import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Req,
  ParseIntPipe,
  UseGuards,
} from '@nestjs/common';
import { UpdateJobAlertDto } from './dto/update-alert.dto';
import { JobAlertsService } from './alerts.service';
import { CreateJobAlertDto } from './dto/create-alert.dto';
import { JwtAuthGuard } from 'src/auth/guards/jwt.guard';

@UseGuards(JwtAuthGuard)
@Controller('job-alerts')
export class JobAlertsController {
  constructor(private readonly service: JobAlertsService) {}

  @Post()
  create(@Body() dto: CreateJobAlertDto, @Req() req: any) {
    return this.service.createForCandidate(req.user.userId, dto);
  }

  @Get()
  findMine(@Req() req: any) {
    return this.service.findByCandidate(req.user.userId);
  }

  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateJobAlertDto,
    @Req() req: any,
  ) {
    return this.service.updateForCandidate(id, req.user.userId, dto);
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number, @Req() req: any) {
    return this.service.removeForCandidate(id, req.user.userId);
  }

  // Optional: preview this week's matches (no email)
  @Get(':id/preview')
  preview(@Param('id', ParseIntPipe) id: number, @Req() req: any) {
    return this.service.previewWeekly(id, req.user.userId);
  }
}
