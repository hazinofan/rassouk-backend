export class VisibilityEmployerDto {
  views: number;
  clicks: number;
  applications: number;
  ctr: number;          
  applyRate: number;    
}

export class VisibilityMarketDto {
  avgViews: number;
  avgClicks: number;
  avgApplications: number;
  avgCtr: number;
  avgApplyRate: number;
  tenants: number;      
}

export class VisibilityPercentilesDto {
  views: number;        
  ctr: number;          
  applyRate: number;    
  overallScore: number; 
}

export class VisibilityScoreResponseDto {
  range: { from: string; to: string; tz: string };
  employer: VisibilityEmployerDto;
  market: VisibilityMarketDto;
  percentile: VisibilityPercentilesDto;
  generatedAt: string;
}
