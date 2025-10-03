export type TopJob = {
  jobId: number;
  title: string;
  views: number;
  applications: number;
  conversionRate: number;
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
  generatedAt: string;
}
