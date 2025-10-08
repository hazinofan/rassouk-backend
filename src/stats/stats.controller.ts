// src/stats/stats.controller.ts
import { Controller, Get, Param, Query, UseInterceptors } from '@nestjs/common'
import { EmployerOverviewQueryDto } from './dto/overview-query.dto'
import { EmployerOverviewResponseDto } from './dto/overview-response.dto'
import { CacheInterceptor } from '@nestjs/cache-manager'
import { AnalyticsService } from './stats.service'

@UseInterceptors(CacheInterceptor)
@Controller('employers/:tenantId/overview')
export class StatsController {
  constructor(private readonly stats: AnalyticsService) {}

  @Get()
  getOverview(
    @Param('tenantId') tenantId: string,
    @Query() q: EmployerOverviewQueryDto,
  ): Promise<EmployerOverviewResponseDto> {
    return this.stats.getEmployerOverview(Number(tenantId), q)
  }
  
}
