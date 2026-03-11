import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Roles } from 'src/auth/decorators/roles.decorator';
import { RolesGuard } from 'src/auth/decorators/roles.guard';
import { CurrentUser } from 'src/auth/decorators/current-user.decoratoe';
import { JwtAuthGuard } from 'src/auth/guards/jwt.guard';
import { AdminAuditService } from './admin-audit.service';
import { AdminDeleteJobDto } from './dto/admin-delete-job.dto';
import { AdminJobsService } from './admin-jobs.service';
import { AdminJobQueryDto } from './dto/admin-job-query.dto';

@Controller('admin/jobs')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
export class AdminJobsController {
  constructor(
    private readonly jobs: AdminJobsService,
    private readonly audit: AdminAuditService,
  ) {}

  @Get()
  list(@Query() query: AdminJobQueryDto) {
    return this.jobs.list(query);
  }

  @Get(':id')
  getOne(@Param('id', ParseIntPipe) id: number) {
    return this.jobs.getOne(id);
  }

  @Delete(':id')
  async delete(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: AdminDeleteJobDto,
    @CurrentUser() actor: any,
    @Req() req: any,
  ) {
    const result = await this.jobs.delete(id, dto);
    await this.audit.log({
      actorUserId: actor.id,
      action: 'job.delete',
      entityType: 'job',
      entityId: id,
      payload: { reason: dto.reason },
      ip: req.ip ?? null,
      userAgent: req.headers?.['user-agent'] ?? null,
    });
    return result;
  }
}
