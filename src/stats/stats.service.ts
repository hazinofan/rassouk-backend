// src/analytics/analytics.service.ts
import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, In, Repository } from 'typeorm';
import { EmployerOverviewResponseDto, TopJob } from './dto/overview-response.dto';
import { Job } from '../jobs/entities/job.entity';
import { Application } from '../applications/entities/application.entity';
import { JobClickEvent } from './entities/job-click-event.entity';
import { JobEvent } from '../stats/entities/job-view-event.entity';
import { addDays, endOfDay, startOfDay } from 'date-fns';
import { EmployerOverviewQueryDto } from './dto/create-stat.dto';
import { TrackClickDto } from './dto/track-click.dto';
import { TrackViewDto } from './dto/track-view.dto';

function ymdUTC(d = new Date()) {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

@Injectable()
export class AnalyticsService {
  constructor(
    @InjectRepository(Job) private jobsRepo: Repository<Job>,
    @InjectRepository(Application) private appsRepo: Repository<Application>,
    @InjectRepository(JobEvent) private viewRepo: Repository<JobEvent>,
    @InjectRepository(JobClickEvent) private clicksRepo: Repository<JobClickEvent>,
  ) { }

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
    const viewsQB = this.viewRepo
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
      const vRows = await this.viewRepo
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

  async recordView(dto: TrackViewDto) {
    const viewDate = ymdUTC();
    try {
      await this.viewRepo.insert({
        jobId: dto.jobId,
        tenantId: dto.tenantId ?? null,
        sessionId: dto.sessionId ?? null,
        referrer: dto.referrer ?? null,
        source: dto.source ?? null,
        viewDate,
      });
    } catch (e: any) {
      // ignore duplicates from the unique index (retry/reload safe)
      if (String(e?.code) !== 'ER_DUP_ENTRY' && String(e?.errno) !== '1062') throw e;
    }
  }

  async recordClick(dto: TrackClickDto) {
    const clickDate = ymdUTC();
    try {
      await this.clicksRepo.insert({
        jobId: dto.jobId,
        tenantId: dto.tenantId ?? null,
        sessionId: dto.sessionId ?? null,
        source: dto.source ?? null,
        clickDate,
      });
    } catch (e: any) {
      if (String(e?.code) !== 'ER_DUP_ENTRY' && String(e?.errno) !== '1062') throw e;
    }
  }

  async getViewsStats(tenantId: number, query: EmployerOverviewQueryDto) {
    const { fromDate, toDate } = this.resolveRange(query);

    // convert to 'YYYY-MM-DD' strings to match viewDate
    const fromStr = fromDate.toISOString().slice(0, 10);
    const toStr = toDate.toISOString().slice(0, 10);

    // Jobs of this tenant (adjust if you keep relation instead of employerId field)
    const jobs = await this.jobsRepo.find({
      // where: { employerId: tenantId },
      select: ['id', 'title'],
    });
    const jobIds = jobs.map(j => j.id);
    if (jobIds.length === 0) {
      return { total: 0, daily: [], byJob: [], generatedAt: new Date().toISOString() };
    }

    // TOTAL views in window
    const totalRow = await this.viewRepo.createQueryBuilder('e')
      .select('COUNT(*)', 'c')
      .where('e.tenantId = :tenantId', { tenantId })
      .andWhere('e.jobId IN (:...jobIds)', { jobIds })
      .andWhere('e.viewDate BETWEEN :from AND :to', { from: fromStr, to: toStr })
      .getRawOne<{ c: string }>();
    const total = Number(totalRow?.c || 0);

    // DAILY series
    const dailyRows = await this.viewRepo.createQueryBuilder('e')
      .select('e.viewDate', 'd')
      .addSelect('COUNT(*)', 'c')
      .where('e.tenantId = :tenantId', { tenantId })
      .andWhere('e.jobId IN (:...jobIds)', { jobIds })
      .andWhere('e.viewDate BETWEEN :from AND :to', { from: fromStr, to: toStr })
      .groupBy('e.viewDate')
      .orderBy('e.viewDate', 'ASC')
      .getRawMany<{ d: string; c: string }>();
    const daily = dailyRows.map(r => ({ date: r.d, count: Number(r.c || 0) }));

    // BY JOB
    const byJobRows = await this.viewRepo.createQueryBuilder('e')
      .select('e.jobId', 'jobId')
      .addSelect('COUNT(*)', 'c')
      .where('e.tenantId = :tenantId', { tenantId })
      .andWhere('e.jobId IN (:...jobIds)', { jobIds })
      .andWhere('e.viewDate BETWEEN :from AND :to', { from: fromStr, to: toStr })
      .groupBy('e.jobId')
      .orderBy('c', 'DESC')
      .getRawMany<{ jobId: string; c: string }>();

    const titleById = new Map(jobs.map(j => [j.id, j.title]));
    const byJob = byJobRows.map(r => ({
      jobId: Number(r.jobId),
      title: titleById.get(Number(r.jobId)) ?? '',
      count: Number(r.c || 0),
    }));

    return { total, daily, byJob, generatedAt: new Date().toISOString() };
  }

  async getClicksStats(tenantId: number, query: EmployerOverviewQueryDto) {
    const { fromDate, toDate } = this.resolveRange(query);
    const fromStr = fromDate.toISOString().slice(0, 10);
    const toStr = toDate.toISOString().slice(0, 10);

    const jobs = await this.jobsRepo.find({
      // where: { employerId: tenantId },
      select: ['id', 'title'],
    });
    const jobIds = jobs.map(j => j.id);
    if (jobIds.length === 0) {
      return { total: 0, daily: [], byJob: [], generatedAt: new Date().toISOString() };
    }

    const totalRow = await this.clicksRepo.createQueryBuilder('e')
      .select('COUNT(*)', 'c')
      .where('e.tenantId = :tenantId', { tenantId })
      .andWhere('e.jobId IN (:...jobIds)', { jobIds })
      .andWhere('e.clickDate BETWEEN :from AND :to', { from: fromStr, to: toStr })
      .getRawOne<{ c: string }>();
    const total = Number(totalRow?.c || 0);

    const dailyRows = await this.clicksRepo.createQueryBuilder('e')
      .select('e.clickDate', 'd')
      .addSelect('COUNT(*)', 'c')
      .where('e.tenantId = :tenantId', { tenantId })
      .andWhere('e.jobId IN (:...jobIds)', { jobIds })
      .andWhere('e.clickDate BETWEEN :from AND :to', { from: fromStr, to: toStr })
      .groupBy('e.clickDate')
      .orderBy('e.clickDate', 'ASC')
      .getRawMany<{ d: string; c: string }>();
    const daily = dailyRows.map(r => ({ date: r.d, count: Number(r.c || 0) }));

    const byJobRows = await this.clicksRepo.createQueryBuilder('e')
      .select('e.jobId', 'jobId')
      .addSelect('COUNT(*)', 'c')
      .where('e.tenantId = :tenantId', { tenantId })
      .andWhere('e.jobId IN (:...jobIds)', { jobIds })
      .andWhere('e.clickDate BETWEEN :from AND :to', { from: fromStr, to: toStr })
      .groupBy('e.jobId')
      .orderBy('c', 'DESC')
      .getRawMany<{ jobId: string; c: string }>();

    const titleById = new Map(jobs.map(j => [j.id, j.title]));
    const byJob = byJobRows.map(r => ({
      jobId: Number(r.jobId),
      title: titleById.get(Number(r.jobId)) ?? '',
      count: Number(r.c || 0),
    }));

    return { total, daily, byJob, generatedAt: new Date().toISOString() };
  }

  async getTrafficSources(tenantId: number, q: { from?: string; to?: string; range?: '7d' | '30d' | '90d' | 'custom' }) {
    const { fromDate, toDate } = this.resolveRange(q);
    const fromStr = fromDate.toISOString().slice(0, 10);
    const toStr = toDate.toISOString().slice(0, 10);

    // ---- Normalizers ----
    // VIEWS: we can use source OR referrer host (because views table has referrer)
    const normalizeViews = `
    CASE
      WHEN e.source IS NOT NULL AND e.source <> '' THEN LOWER(e.source)
      WHEN (e.referrer IS NULL OR e.referrer = '') THEN 'direct'
      ELSE LOWER(SUBSTRING_INDEX(REPLACE(REPLACE(e.referrer,'https://',''),'http://',''), '/', 1))
    END
  `;

    // CLICKS: no referrer column on clicks → only use source; fallback to 'direct'
    const normalizeClicks = `
    CASE
      WHEN e.source IS NOT NULL AND e.source <> '' THEN LOWER(e.source)
      ELSE 'direct'
    END
  `;

    // ---- Views aggregation ----
    const viewRows = await this.viewRepo.createQueryBuilder('e')
      .select(`${normalizeViews}`, 'src')
      .addSelect('COUNT(*)', 'c')
      .where('e.tenantId = :tenantId', { tenantId })
      .andWhere('e.viewDate BETWEEN :from AND :to', { from: fromStr, to: toStr })
      .groupBy('src')
      .getRawMany<{ src: string; c: string }>();

    // ---- Clicks aggregation ----
    const clickRows = await this.clicksRepo.createQueryBuilder('e')
      .select(`${normalizeClicks}`, 'src')
      .addSelect('COUNT(*)', 'c')
      .where('e.tenantId = :tenantId', { tenantId })
      .andWhere('e.clickDate BETWEEN :from AND :to', { from: fromStr, to: toStr })
      .groupBy('src')
      .getRawMany<{ src: string; c: string }>();

    // ---- Merge (views + clicks) ----
    const map = new Map<string, number>();
    for (const r of [...viewRows, ...clickRows]) {
      const k = (r.src || 'direct').trim();
      map.set(k, (map.get(k) || 0) + Number(r.c || 0));
    }

    // Pretty labels
    const pretty = (k: string) => {
      if (k === 'direct') return 'Direct';
      if (k.includes('google')) return 'Google';
      if (k.includes('linkedin')) return 'LinkedIn';
      if (k.includes('facebook')) return 'Facebook';
      if (k.includes('localhost')) return 'Interne';
      return k.replace(/^www\./, '');
    };

    const items = Array.from(map.entries())
      .map(([k, v]) => ({ label: pretty(k), count: v }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);

    return { items, generatedAt: new Date().toISOString() };
  }

  private pct(value: number, sorted: number[]): number {
    if (!sorted.length) return 0;
    // position of the last element strictly less than value
    let idx = 0;
    while (idx < sorted.length && sorted[idx] < value) idx++;
    const p = (idx / sorted.length) * 100;
    return Math.max(0, Math.min(100, +p.toFixed(1)));
  }

  async getVisibilityScore(
    tenantId: number,
    query: { from?: string; to?: string; range?: '7d' | '30d' | '90d' | 'custom'; tz?: string }
  ) {
    const tz = query.tz || 'Africa/Casablanca';
    const { fromDate, toDate } = this.resolveRange(query);
    const fromStr = fromDate.toISOString().slice(0, 10);
    const toStr = toDate.toISOString().slice(0, 10);

    // ---- Aggregate VIEWS per tenant ----
    const viewRows = await this.viewRepo.createQueryBuilder('e')
      .select('e.tenantId', 'tenantId')
      .addSelect('COUNT(*)', 'views')
      .where('e.viewDate BETWEEN :from AND :to', { from: fromStr, to: toStr })
      .groupBy('e.tenantId')
      .getRawMany<{ tenantId: string; views: string }>();

    // ---- Aggregate CLICKS per tenant ----
    const clickRows = await this.clicksRepo.createQueryBuilder('e')
      .select('e.tenantId', 'tenantId')
      .addSelect('COUNT(*)', 'clicks')
      .where('e.clickDate BETWEEN :from AND :to', { from: fromStr, to: toStr })
      .groupBy('e.tenantId')
      .getRawMany<{ tenantId: string; clicks: string }>();

    // ---- Aggregate APPLICATIONS per tenant (via Job) ----
    const appRows = await this.appsRepo.createQueryBuilder('a')
      .innerJoin('a.job', 'j')              // adapt property name if different
      .select('j.employerId', 'tenantId')   // or 'j.employer.id' if relation object
      .addSelect('COUNT(*)', 'apps')
      .where('a.createdAt BETWEEN :from AND :to', { from: fromDate, to: toDate })
      .groupBy('j.employerId')
      .getRawMany<{ tenantId: string; apps: string }>();

    // ---- Merge into map: tenantId -> {views, clicks, apps} ----
    type Agg = { views: number; clicks: number; apps: number };
    const agg = new Map<number, Agg>();

    for (const r of viewRows) {
      const t = Number(r.tenantId); if (!t) continue;
      agg.set(t, { ...(agg.get(t) || { views: 0, clicks: 0, apps: 0 }), views: Number(r.views || 0) });
    }
    for (const r of clickRows) {
      const t = Number(r.tenantId); if (!t) continue;
      const prev = agg.get(t) || { views: 0, clicks: 0, apps: 0 };
      prev.clicks = Number(r.clicks || 0);
      agg.set(t, prev);
    }
    for (const r of appRows) {
      const t = Number(r.tenantId); if (!t) continue;
      const prev = agg.get(t) || { views: 0, clicks: 0, apps: 0 };
      prev.apps = Number(r.apps || 0);
      agg.set(t, prev);
    }

    // Ensure target tenant exists in map (with zeros) so percentiles compare correctly
    if (!agg.has(tenantId)) agg.set(tenantId, { views: 0, clicks: 0, apps: 0 });

    // ---- Build distributions ----
    const distViews: number[] = [];
    const distCtr: number[] = [];
    const distApply: number[] = [];

    // also compute market averages
    let sumViews = 0, sumClicks = 0, sumApps = 0;

    for (const { views, clicks, apps } of agg.values()) {
      sumViews += views; sumClicks += clicks; sumApps += apps;
      const ctr = views > 0 ? clicks / views : 0;
      const apply = views > 0 ? apps / views : 0;
      distViews.push(views);
      distCtr.push(ctr);
      distApply.push(apply);
    }

    const tenants = agg.size;
    distViews.sort((a, b) => a - b);
    distCtr.sort((a, b) => a - b);
    distApply.sort((a, b) => a - b);

    const market = {
      avgViews: tenants ? sumViews / tenants : 0,
      avgClicks: tenants ? sumClicks / tenants : 0,
      avgApplications: tenants ? sumApps / tenants : 0,
      avgCtr: tenants ? (sumViews > 0 ? sumClicks / sumViews : 0) : 0,
      avgApplyRate: tenants ? (sumViews > 0 ? sumApps / sumViews : 0) : 0,
      tenants
    };

    // ---- Employer values ----
    const me = agg.get(tenantId)!;
    const meCtr = me.views > 0 ? me.clicks / me.views : 0;
    const meApply = me.views > 0 ? me.apps / me.views : 0;

    // ---- Percentiles ----
    const pViews = this.pct(me.views, distViews);
    const pCtr = this.pct(meCtr, distCtr);
    const pApply = this.pct(meApply, distApply);

    // Weighted overall score (tweak weights as you like)
    const wViews = 0.30, wCtr = 0.35, wApply = 0.35;
    const overall = +(pViews * wViews + pCtr * wCtr + pApply * wApply).toFixed(1);

    return {
      range: { from: fromDate.toISOString(), to: toDate.toISOString(), tz },
      employer: { views: me.views, clicks: me.clicks, applications: me.apps, ctr: meCtr, applyRate: meApply },
      market,
      percentile: { views: pViews, ctr: pCtr, applyRate: pApply, overallScore: overall },
      generatedAt: new Date().toISOString()
    };
  }

}
