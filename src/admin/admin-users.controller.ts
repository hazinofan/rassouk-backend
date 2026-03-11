import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Query,
  Req,
  Post,
  UseGuards,
} from '@nestjs/common';
import { Roles } from 'src/auth/decorators/roles.decorator';
import { RolesGuard } from 'src/auth/decorators/roles.guard';
import { CurrentUser } from 'src/auth/decorators/current-user.decoratoe';
import { JwtAuthGuard } from 'src/auth/guards/jwt.guard';
import { AdminAuditService } from './admin-audit.service';
import { AdminBanUserDto } from './dto/admin-ban-user.dto';
import { AdminCreateAdminUserDto } from './dto/admin-create-admin-user.dto';
import { AdminUserQueryDto } from './dto/admin-user-query.dto';
import { AdminUsersService } from './admin-users.service';

@Controller('admin/users')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
export class AdminUsersController {
  constructor(
    private readonly users: AdminUsersService,
    private readonly audit: AdminAuditService,
  ) {}

  @Get()
  list(@Query() query: AdminUserQueryDto) {
    return this.users.list(query);
  }

  @Post()
  async createAdmin(
    @Body() dto: AdminCreateAdminUserDto,
    @CurrentUser() actor: any,
    @Req() req: any,
  ) {
    const result = await this.users.createAdmin(dto);
    await this.audit.log({
      actorUserId: actor.id,
      action: 'user.create_admin',
      entityType: 'user',
      entityId: result.id,
      payload: { email: result.email },
      ip: req.ip ?? null,
      userAgent: req.headers?.['user-agent'] ?? null,
    });
    return result;
  }

  @Get(':id')
  getOne(@Param('id', ParseIntPipe) id: number) {
    return this.users.getById(id);
  }

  @Patch(':id/ban')
  async ban(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: AdminBanUserDto,
    @CurrentUser() actor: any,
    @Req() req: any,
  ) {
    const result = await this.users.banUser(id, dto, actor.id);
    await this.audit.log({
      actorUserId: actor.id,
      action: 'user.ban',
      entityType: 'user',
      entityId: id,
      payload: { reason: dto.reason, until: dto.until ?? null },
      ip: req.ip ?? null,
      userAgent: req.headers?.['user-agent'] ?? null,
    });
    return result;
  }

  @Patch(':id/unban')
  async unban(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() actor: any,
    @Req() req: any,
  ) {
    const result = await this.users.unbanUser(id);
    await this.audit.log({
      actorUserId: actor.id,
      action: 'user.unban',
      entityType: 'user',
      entityId: id,
      ip: req.ip ?? null,
      userAgent: req.headers?.['user-agent'] ?? null,
    });
    return result;
  }

  @Delete(':id')
  async delete(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() actor: any,
    @Req() req: any,
  ) {
    const result = await this.users.deleteUser(id, actor.id);
    await this.audit.log({
      actorUserId: actor.id,
      action: 'user.delete',
      entityType: 'user',
      entityId: id,
      ip: req.ip ?? null,
      userAgent: req.headers?.['user-agent'] ?? null,
    });
    return result;
  }
}
