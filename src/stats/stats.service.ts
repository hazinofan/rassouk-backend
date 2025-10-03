// src/analytics/analytics.service.ts
import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, In, Repository } from 'typeorm';
import { EmployerOverviewResponseDto, TopJob } from './dto/overview-response.dto';
import { Job } from '../jobs/entities/job.entity';
import { Application } from '../applications/entities/application.entity';
import { JobClickEvent } from './entities/job-click-event.entity';
import { JobViewEvent } from './entities/stat.entity';
import { addDays, endOfDay, startOfDay } from 'date-fns';
import { EmployerOverviewQueryDto } from './dto/create-stat.dto';

@Injectable()
export class AnalyticsService {
  constructor(
    @InjectRepository(Job) private jobsRepo: Repository<Job>,
    @InjectRepository(Application) private appsRepo: Repository<Application>,
    @InjectRepository(JobViewEvent) private viewsRepo: Repository<JobViewEvent>,
    @InjectRepository(JobClickEvent) private clicksRepo: Repository<JobClickEvent>,
  ) {}

  async getEmployerOverview(
    tenantId: number,
    query: EmployerOverviewQueryDto,
  ): Promise<EmployerOverviewResponseDto> {
    const { from, to, range, tz = 'Africa/Casablanca' } = query;

    const { fromDate, toDate } = this.resolveRange({ from, to, range });

    // 1) Base jobs for this tenant
    const jobs = await this.jobsRepo.find({
      //  where: { employerId: { id: tenantId } },
      select: ['id', 'title', 'status', 'createdAt'],
    });
    const jobIds = jobs.map(j => j.id);
    if (jobIds.length === 0) {
      return {
        range: { from: fromDate.toISOString(), to: toDate.toISOString(), tz },
        jobsActive: 0,
        views: 0,
        uniqueVisitors: 0,
        clicks: 0,
        applications: 0,
        ctr: 0,
        conversionRate: 0,
        timeToFirstAppHours: 0,
        hires: 0,
        topJobs: [],
        generatedAt: new Date().toISOString(),
      };
    }

    // 2) Jobs active (status-based; adapt to your enum)
    const jobsActive = jobs.filter(j => String(j['status']).toUpperCase() === 'ACTIVE').length;

    // 3) Aggregate VIEWS
    const viewsQB = this.viewsRepo
      .createQueryBuilder('e')
      .select('COUNT(*)', 'views')
      .addSelect('COUNT(DISTINCT e.sessionId)', 'uniqueVisitors')
      .where('e.tenantId = :tenantId', { tenantId })
      .andWhere('e.jobId IN (:...jobIds)', { jobIds })
      .andWhere('e.createdAt BETWEEN :from AND :to', { from: fromDate, to: toDate });

    const { views, uniqueVisitors } = await viewsQB.getRawOne<{ views: string; uniqueVisitors: string }>()
      .then(r => ({
        views: Number(r?.views || 0),
        uniqueVisitors: Number(r?.uniqueVisitors || 0),
      }));

    // 4) Aggregate CLICKS
    const clicksQB = this.clicksRepo
      .createQueryBuilder('e')
      .select('COUNT(*)', 'clicks')
      .where('e.tenantId = :tenantId', { tenantId })
      .andWhere('e.jobId IN (:...jobIds)', { jobIds })
      .andWhere('e.createdAt BETWEEN :from AND :to', { from: fromDate, to: toDate });

    const { clicks } = await clicksQB.getRawOne<{ clicks: string }>()
      .then(r => ({ clicks: Number(r?.clicks || 0) }));

    // 5) Aggregate APPLICATIONS (created in window)
    const appsQB = this.appsRepo
      .createQueryBuilder('a')
      .select('COUNT(*)', 'applications')
      .where('a.jobId IN (:...jobIds)', { jobIds })
      .andWhere('a.createdAt BETWEEN :from AND :to', { from: fromDate, to: toDate });

    const { applications } = await appsQB.getRawOne<{ applications: string }>()
      .then(r => ({ applications: Number(r?.applications || 0) }));

    // 6) HIRES (status-based; adapt to your enum)
    const hireStatuses = ['HIRED', 'OFFER_ACCEPTED', 'OFFERED']; // tweak to your enum
    const hiresQB = this.appsRepo
      .createQueryBuilder('a')
      .select('COUNT(*)', 'hires')
      .where('a.jobId IN (:...jobIds)', { jobIds })
      .andWhere('a.status IN (:...st)', { st: hireStatuses })
      .andWhere('a.updatedAt BETWEEN :from AND :to', { from: fromDate, to: toDate });

    const { hires } = await hiresQB.getRawOne<{ hires: string }>()
      .then(r => ({ hires: Number(r?.hires || 0) }));

    // 7) Time to first application (avg hours job.createdAt → first app)
    //    (we compute first app per job overall, then average for jobs whose first app falls within the range)
    const firstAppSub = this.appsRepo
      .createQueryBuilder('a')
      .select('a.jobId', 'jobId')
      .addSelect('MIN(a.createdAt)', 'firstAppAt')
      .where('a.jobId IN (:...jobIds)', { jobIds })
      .groupBy('a.jobId');

    const rowsFA = await firstAppSub.getRawMany<{ jobId: number; firstAppAt: Date }>();

    let timeToFirstAppHours = 0;
    if (rowsFA.length > 0) {
      const diffs: number[] = [];
      const jobsById = new Map(jobs.map(j => [j.id, j]));
      for (const r of rowsFA) {
        const job = jobsById.get(Number(r.jobId));
        if (!job) continue;
        const first = new Date(r.firstAppAt);
        // include only if first app occurred within the reporting window
        if (first >= fromDate && first <= toDate) {
          const publish = new Date(job.createdAt);
          const diffMs = first.getTime() - publish.getTime();
          if (diffMs >= 0) diffs.push(diffMs / (1000 * 60 * 60));
        }
      }
      if (diffs.length > 0) {
        timeToFirstAppHours = diffs.reduce((a, b) => a + b, 0) / diffs.length;
      }
    }

    // 8) Top jobs (by applications desc; include views & conv)
    const topJobsQB = this.appsRepo
      .createQueryBuilder('a')
      .select('a.jobId', 'jobId')
      .addSelect('COUNT(*)', 'apps')
      .where('a.jobId IN (:...jobIds)', { jobIds })
      .andWhere('a.createdAt BETWEEN :from AND :to', { from: fromDate, to: toDate })
      .groupBy('a.jobId')
      .orderBy('apps', 'DESC')
      .limit(5);

    const topAppsRaw = await topJobsQB.getRawMany<{ jobId: string; apps: string }>();
    const topJobIds = topAppsRaw.map(r => Number(r.jobId));
    const topJobsBase = jobs.filter(j => topJobIds.includes(j.id));

    // fetch views for those same jobs (in one go)
    let perJobViews: Record<number, number> = {};
    if (topJobIds.length) {
      const vRows = await this.viewsRepo
        .createQueryBuilder('e')
        .select('e.jobId', 'jobId')
        .addSelect('COUNT(*)', 'views')
        .where('e.tenantId = :tenantId', { tenantId })
        .andWhere('e.jobId IN (:...ids)', { ids: topJobIds })
        .andWhere('e.createdAt BETWEEN :from AND :to', { from: fromDate, to: toDate })
        .groupBy('e.jobId')
        .getRawMany<{ jobId: string; views: string }>();
      perJobViews = vRows.reduce((acc, r) => {
        acc[Number(r.jobId)] = Number(r.views || 0);
        return acc;
      }, {} as Record<number, number>);
    }

    const topJobs: TopJob[] = topJobsBase.map(j => {
      const apps = Number(topAppsRaw.find(r => Number(r.jobId) === j.id)?.apps || 0);
      const v = Number(perJobViews[j.id] || 0);
      const conv = v > 0 ? apps / v : 0;
      return {
        jobId: j.id,
        title: j['title'] as any, // adapt if your Job entity differs
        views: v,
        applications: apps,
        conversionRate: conv,
      };
    });

    const ctr = views > 0 ? clicks / views : 0;
    const conversionRate = views > 0 ? applications / views : 0;

    return {
      range: { from: fromDate.toISOString(), to: toDate.toISOString(), tz },
      jobsActive,
      views,
      uniqueVisitors,
      clicks,
      applications,
      ctr,
      conversionRate,
      timeToFirstAppHours: Number(timeToFirstAppHours.toFixed(1)),
      hires,
      topJobs,
      generatedAt: new Date().toISOString(),
    };
  }

  private resolveRange({
    from,
    to,
    range,
  }: {
    from?: string;
    to?: string;
    range?: '7d' | '30d' | '90d' | 'custom';
  }): { fromDate: Date; toDate: Date } {
    if (range === 'custom') {
      if (!from || !to) throw new BadRequestException('from/to are required for custom range');
      return {
        fromDate: startOfDay(new Date(from)),
        toDate: endOfDay(new Date(to)),
      };
    }
    const today = new Date(); // assume UTC; DB stores UTC (recommended)
    let days = 30;
    if (range === '7d') days = 7;
    if (range === '90d') days = 90;
    const toDate = endOfDay(today);
    const fromDate = startOfDay(addDays(toDate, -days + 1));
    return { fromDate, toDate };
  }
}
