export type TopJob = {
  jobId: number;
  title: string;
  views: number;
  applications: number;
  conversionRate: number;
};

export type OverviewDailyPoint = {
  date: string;
  views: number;
  clicks: number;
  ctr: number;
};

export type OverviewDailyPagination = {
  page: number;
  limit: number;
  totalItems: number;
  totalPages: number;
};

export class EmployerOverviewResponseDto {
  range: { from: string; to: string; tz: string };
  jobsActive: number;
  views: number;
  uniqueVisitors: number;
  clicks: number;
  applications: number;
  ctr: number; 
  conversionRate: number;
  timeToFirstAppHours: number; 
  hires: number;
  topJobs: TopJob[];
  daily: OverviewDailyPoint[];
  dailyPagination: OverviewDailyPagination;
  generatedAt: string;
}
