export type SubscriptionAudience = 'employer' | 'candidate';

export type EmployerPlanKey = 'free' | 'basic' | 'standard' | 'premium';
export type CandidatePlanKey = 'free' | 'starter' | 'pro' | 'elite';
export type PlanKey = EmployerPlanKey | CandidatePlanKey;

export type SubscriptionStatus =
  | 'active'
  | 'canceled'
  | 'inactive'
  | 'past_due'
  | 'trialing';

export type EmployerFeatureKey =
  | 'analytics_basic'
  | 'analytics_advanced'
  | 'analytics_benchmark'
  | 'export_enabled'
  | 'integrations_enabled'
  | 'urgent_jobs_enabled'
  | 'auto_candidate_followup';

export type EmployerLimitKey =
  | 'max_active_jobs'
  | 'max_saved_candidates'
  | 'cv_access_days';

export type CandidateFeatureKey =
  | 'alerts_basic'
  | 'alerts_personalized'
  | 'profile_boost_local'
  | 'profile_boost_priority'
  | 'premium_badge'
  | 'profile_view_stats'
  | 'priority_new_jobs'
  | 'exclusive_jobs_early_access'
  | 'ai_cv_assist'
  | 'career_coaching'
  | 'support_priority'
  | 'support_vip'
  | 'application_history_detailed';

export type CandidateLimitKey =
  | 'max_applications_per_month'
  | 'max_saved_jobs'
  | 'max_stored_cvs';

export interface EmployerEntitlements {
  audience: 'employer';
  planKey: EmployerPlanKey;
  status: SubscriptionStatus;
  startedAt: Date | null;
  currentPeriodEnd: Date | null;
  features: Record<EmployerFeatureKey, boolean>;
  limits: Record<EmployerLimitKey, number | null>;
}

export interface UsageCounter {
  current: number;
  limit: number | null;
  remaining: number | null;
}

export interface EmployerUsage {
  max_active_jobs: UsageCounter;
  max_saved_candidates: UsageCounter;
}

export interface CandidateEntitlements {
  audience: 'candidate';
  planKey: CandidatePlanKey;
  status: SubscriptionStatus;
  startedAt: Date | null;
  currentPeriodEnd: Date | null;
  features: Record<CandidateFeatureKey, boolean>;
  limits: Record<CandidateLimitKey, number | null>;
}

export interface CandidateUsage {
  max_applications_per_month: UsageCounter;
  max_saved_jobs: UsageCounter;
  max_stored_cvs: UsageCounter;
}

export interface EmployerBillingSnapshot extends EmployerEntitlements {
  usage: EmployerUsage;
}

export interface CandidateBillingSnapshot extends CandidateEntitlements {
  usage: CandidateUsage;
}

export type SubscriptionEntitlements =
  | EmployerEntitlements
  | CandidateEntitlements;

export type BillingSnapshot =
  | EmployerBillingSnapshot
  | CandidateBillingSnapshot;

export type FeatureKey = EmployerFeatureKey | CandidateFeatureKey;
export type LimitKey = EmployerLimitKey | CandidateLimitKey;
