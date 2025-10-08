// src/stats/stats-series.controller.ts
import { Controller, Get, Param, Query, UseInterceptors } from '@nestjs/common';
import { CacheInterceptor } from '@nestjs/cache-manager';
import { EmployerOverviewQueryDto } from './dto/overview-query.dto';
import { AnalyticsService } from './stats.service';

@UseInterceptors(CacheInterceptor)
@Controller('employers/:tenantId/stats')
export class StatsSeriesController {
    constructor(private readonly analytics: AnalyticsService) { }

    @Get('views')
    getViewsSeries(
        @Param('tenantId') tenantId: string,
        @Query() q: EmployerOverviewQueryDto
    ) {
        return this.analytics.getViewsStats(Number(tenantId), q);
    }

    @Get('clicks')
    getClicksSeries(
        @Param('tenantId') tenantId: string,
        @Query() q: EmployerOverviewQueryDto
    ) {
        return this.analytics.getClicksStats(Number(tenantId), q);
    }

    @Get('sources')
    getSources(@Param('tenantId') tenantId: string, @Query() q: EmployerOverviewQueryDto) {
        return this.analytics.getTrafficSources(Number(tenantId), q);
    }

    @Get('visibility')
    getVisibility(
        @Param('tenantId') tenantId: string,
        @Query() q: EmployerOverviewQueryDto
    ) {
        return this.analytics.getVisibilityScore(Number(tenantId), q);
    }
}
