// src/stats/stats-series.controller.ts
import {
  Controller,
  ForbiddenException,
  Get,
  Header,
  Param,
  Query,
  Req,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { CacheInterceptor } from '@nestjs/cache-manager';
import { EmployerOverviewQueryDto } from './dto/overview-query.dto';
import { AnalyticsService } from './stats.service';
import { JwtAuthGuard } from 'src/auth/guards/jwt.guard';
import { RolesGuard } from 'src/auth/decorators/roles.guard';
import { Roles } from 'src/auth/decorators/roles.decorator';
import { requireFeature } from 'src/subscriptions/feature.guard';

@UseInterceptors(CacheInterceptor)
@Controller('employers/:tenantId/stats')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('employer')
export class StatsSeriesController {
    constructor(private readonly analytics: AnalyticsService) { }

    private assertTenantAccess(req: any, tenantId: string) {
        if (Number(req.user.id) !== Number(tenantId)) {
            throw new ForbiddenException('Forbidden');
        }
    }

    @Get('views')
    getViewsSeries(
        @Req() req: any,
        @Param('tenantId') tenantId: string,
        @Query() q: EmployerOverviewQueryDto
    ) {
        this.assertTenantAccess(req, tenantId);
        return this.analytics.getViewsStats(Number(tenantId), q);
    }

    @Get('clicks')
    getClicksSeries(
        @Req() req: any,
        @Param('tenantId') tenantId: string,
        @Query() q: EmployerOverviewQueryDto
    ) {
        this.assertTenantAccess(req, tenantId);
        return this.analytics.getClicksStats(Number(tenantId), q);
    }

    @UseGuards(requireFeature('analytics_advanced'))
    @Get('sources')
    getSources(@Req() req: any, @Param('tenantId') tenantId: string, @Query() q: EmployerOverviewQueryDto) {
        this.assertTenantAccess(req, tenantId);
        return this.analytics.getTrafficSources(Number(tenantId), q);
    }

    @UseGuards(requireFeature('analytics_benchmark'))
    @Get('visibility')
    getVisibility(
        @Req() req: any,
        @Param('tenantId') tenantId: string,
        @Query() q: EmployerOverviewQueryDto
    ) {
        this.assertTenantAccess(req, tenantId);
        return this.analytics.getVisibilityScore(Number(tenantId), q);
    }

    @Get('timeline')
    getTimeline(
        @Req() req: any,
        @Param('tenantId') tenantId: string,
        @Query() q: EmployerOverviewQueryDto
    ) {
        this.assertTenantAccess(req, tenantId);
        return this.analytics.getPerformanceTimeline(Number(tenantId), q);
    }

    @UseGuards(requireFeature('analytics_advanced'))
    @Get('categories')
    getCategories(
        @Req() req: any,
        @Param('tenantId') tenantId: string,
        @Query() q: EmployerOverviewQueryDto
    ) {
        this.assertTenantAccess(req, tenantId);
        return this.analytics.getCategoryBreakdown(Number(tenantId), q);
    }

    @UseGuards(requireFeature('analytics_advanced'))
    @Get('recent-activity')
    getRecentActivity(
        @Req() req: any,
        @Param('tenantId') tenantId: string,
        @Query() q: EmployerOverviewQueryDto
    ) {
        this.assertTenantAccess(req, tenantId);
        return this.analytics.getRecentActivity(Number(tenantId), q);
    }

    @UseGuards(requireFeature('export_enabled'))
    @Get('export.csv')
    @Header('Content-Type', 'text/csv; charset=utf-8')
    @Header('Content-Disposition', 'attachment; filename=\"stats-export.csv\"')
    async exportCsv(
        @Req() req: any,
        @Param('tenantId') tenantId: string,
        @Query() q: EmployerOverviewQueryDto,
    ) {
        this.assertTenantAccess(req, tenantId);
        const overview = await this.analytics.getEmployerOverview(Number(tenantId), q);
        const rows = [
            ['metric', 'value'],
            ['jobsActive', overview.jobsActive],
            ['views', overview.views],
            ['uniqueVisitors', overview.uniqueVisitors],
            ['clicks', overview.clicks],
            ['applications', overview.applications],
            ['ctr', overview.ctr],
            ['conversionRate', overview.conversionRate],
            ['timeToFirstAppHours', overview.timeToFirstAppHours],
            ['hires', overview.hires],
        ];

        return rows.map((row) => row.join(',')).join('\n');
    }
}
