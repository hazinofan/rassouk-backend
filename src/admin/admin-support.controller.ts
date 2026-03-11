import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Roles } from 'src/auth/decorators/roles.decorator';
import { RolesGuard } from 'src/auth/decorators/roles.guard';
import { CurrentUser } from 'src/auth/decorators/current-user.decoratoe';
import { JwtAuthGuard } from 'src/auth/guards/jwt.guard';
import { AdminAuditService } from './admin-audit.service';
import { AdminSupportService } from './admin-support.service';
import { AdminSupportAssignDto } from './dto/admin-support-assign.dto';
import { AdminSupportQueryDto } from './dto/admin-support-query.dto';
import { AdminSupportStatusDto } from './dto/admin-support-status.dto';

@Controller('admin/support/messages')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
export class AdminSupportController {
  constructor(
    private readonly support: AdminSupportService,
    private readonly audit: AdminAuditService,
  ) {}

  @Get()
  list(@Query() query: AdminSupportQueryDto) {
    return this.support.list(query);
  }

  @Get(':id')
  getOne(@Param('id', ParseIntPipe) id: number) {
    return this.support.getOne(id);
  }

  @Patch(':id/status')
  async setStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: AdminSupportStatusDto,
    @CurrentUser() actor: any,
    @Req() req: any,
  ) {
    const result = await this.support.setStatus(id, dto, actor.id);
    await this.audit.log({
      actorUserId: actor.id,
      action: 'support.status',
      entityType: 'support_message',
      entityId: id,
      payload: { status: dto.status },
      ip: req.ip ?? null,
      userAgent: req.headers?.['user-agent'] ?? null,
    });
    return result;
  }

  @Patch(':id/assign')
  async assign(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: AdminSupportAssignDto,
    @CurrentUser() actor: any,
    @Req() req: any,
  ) {
    const result = await this.support.assign(id, dto);
    await this.audit.log({
      actorUserId: actor.id,
      action: 'support.assign',
      entityType: 'support_message',
      entityId: id,
      payload: { adminUserId: dto.adminUserId },
      ip: req.ip ?? null,
      userAgent: req.headers?.['user-agent'] ?? null,
    });
    return result;
  }
}
