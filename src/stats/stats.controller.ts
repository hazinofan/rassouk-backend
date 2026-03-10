// src/stats/stats.controller.ts
import {
  Controller,
  ForbiddenException,
  Get,
  Param,
  Query,
  Req,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common'
import { EmployerOverviewQueryDto } from './dto/overview-query.dto'
import { EmployerOverviewResponseDto } from './dto/overview-response.dto'
import { CacheInterceptor } from '@nestjs/cache-manager'
import { AnalyticsService } from './stats.service'
import { JwtAuthGuard } from 'src/auth/guards/jwt.guard'
import { RolesGuard } from 'src/auth/decorators/roles.guard'
import { Roles } from 'src/auth/decorators/roles.decorator'

@UseInterceptors(CacheInterceptor)
@Controller('employers/:tenantId/overview')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('employer')
export class StatsController {
  constructor(private readonly stats: AnalyticsService) {}

  @Get()
  getOverview(
    @Req() req: any,
    @Param('tenantId') tenantId: string,
    @Query() q: EmployerOverviewQueryDto,
  ): Promise<EmployerOverviewResponseDto> {
    if (Number(req.user.id) !== Number(tenantId)) {
      throw new ForbiddenException('Forbidden');
    }
    return this.stats.getEmployerOverview(Number(tenantId), q)
  }
  
}
