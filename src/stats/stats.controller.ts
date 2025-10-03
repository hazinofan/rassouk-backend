import { Controller, Get, Param, Query } from '@nestjs/common';
import { EmployerOverviewResponseDto } from './dto/overview-response.dto';
import { EmployerOverviewQueryDto } from './dto/create-stat.dto';
import { AnalyticsService } from './stats.service';

@Controller('api/v1/employers/:tenantId/overview')
export class AnalyticsController {
  constructor(private readonly analytics: AnalyticsService) {}

  @Get()
  async getEmployerOverview(
    @Param('tenantId') tenantId: string,
    @Query() query: EmployerOverviewQueryDto,
  ): Promise<EmployerOverviewResponseDto> {
    return this.analytics.getEmployerOverview(Number(tenantId), query);
  }
}
