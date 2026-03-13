import {
  CandidateEntitlements,
  CandidatePlanKey,
  EmployerEntitlements,
  EmployerPlanKey,
} from './subscription.types';

type EmployerPlanConfig = Omit<
  EmployerEntitlements,
  'status' | 'startedAt' | 'currentPeriodEnd'
> & {
  billing: {
    priceMonthly: number;
    currency: string;
    label: string;
  };
};

export const EMPLOYER_PLANS: Record<EmployerPlanKey, EmployerPlanConfig> = {
  free: {
    audience: 'employer',
    planKey: 'free',
    features: {
      analytics_basic: true,
      analytics_advanced: false,
      analytics_benchmark: false,
      export_enabled: false,
      integrations_enabled: false,
      urgent_jobs_enabled: false,
      auto_candidate_followup: false,
      featured_jobs_enabled: false,
      candidate_contact_enabled: false,
      candidate_notes_enabled: true,
      interview_scheduling_enabled: false,
      priority_support_enabled: false,
      verified_company_badge: false,
      job_refresh_enabled: false,
      bulk_application_actions_enabled: false,
    },
    limits: {
      max_active_jobs: 2,
      max_saved_candidates: 3,
      cv_access_days: 0,
      max_featured_jobs: 0,
      max_job_refreshes_per_month: 0,
      max_contacted_candidates_per_month: 0,
    },
    billing: {
      priceMonthly: 0,
      currency: 'USD',
      label: 'Free',
    },
  },
  basic: {
    audience: 'employer',
    planKey: 'basic',
    features: {
      analytics_basic: true,
      analytics_advanced: false,
      analytics_benchmark: false,
      export_enabled: false,
      integrations_enabled: false,
      urgent_jobs_enabled: false,
      auto_candidate_followup: false,
      featured_jobs_enabled: false,
      candidate_contact_enabled: true,
      candidate_notes_enabled: true,
      interview_scheduling_enabled: false,
      priority_support_enabled: false,
      verified_company_badge: false,
      job_refresh_enabled: true,
      bulk_application_actions_enabled: false,
    },
    limits: {
      max_active_jobs: 3,
      max_saved_candidates: 10,
      cv_access_days: 15,
      max_featured_jobs: 0,
      max_job_refreshes_per_month: 3,
      max_contacted_candidates_per_month: 20,
    },
    billing: {
      priceMonthly: 6.99,
      currency: 'USD',
      label: 'Basic',
    },
  },
  standard: {
    audience: 'employer',
    planKey: 'standard',
    features: {
      analytics_basic: true,
      analytics_advanced: true,
      analytics_benchmark: false,
      export_enabled: false,
      integrations_enabled: false,
      urgent_jobs_enabled: true,
      auto_candidate_followup: true,
      featured_jobs_enabled: true,
      candidate_contact_enabled: true,
      candidate_notes_enabled: true,
      interview_scheduling_enabled: true,
      priority_support_enabled: false,
      verified_company_badge: false,
      job_refresh_enabled: true,
      bulk_application_actions_enabled: true,
    },
    limits: {
      max_active_jobs: 6,
      max_saved_candidates: 25,
      cv_access_days: 30,
      max_featured_jobs: 2,
      max_job_refreshes_per_month: 15,
      max_contacted_candidates_per_month: 80,
    },
    billing: {
      priceMonthly: 14.99,
      currency: 'USD',
      label: 'Standard',
    },
  },
  premium: {
    audience: 'employer',
    planKey: 'premium',
    features: {
      analytics_basic: true,
      analytics_advanced: true,
      analytics_benchmark: true,
      export_enabled: true,
      integrations_enabled: true,
      urgent_jobs_enabled: true,
      auto_candidate_followup: true,
      featured_jobs_enabled: true,
      candidate_contact_enabled: true,
      candidate_notes_enabled: true,
      interview_scheduling_enabled: true,
      priority_support_enabled: true,
      verified_company_badge: true,
      job_refresh_enabled: true,
      bulk_application_actions_enabled: true,
    },
    limits: {
      max_active_jobs: null,
      max_saved_candidates: 100,
      cv_access_days: 60,
      max_featured_jobs: 10,
      max_job_refreshes_per_month: null,
      max_contacted_candidates_per_month: null,
    },
    billing: {
      priceMonthly: 29.99,
      currency: 'USD',
      label: 'Premium',
    },
  },
};

export const DEFAULT_EMPLOYER_PLAN_KEY: EmployerPlanKey = 'free';

type CandidatePlanConfig = Omit<
  CandidateEntitlements,
  'status' | 'startedAt' | 'currentPeriodEnd'
> & {
  billing: {
    priceMonthly: number;
    currency: string;
    label: string;
  };
};

export const CANDIDATE_PLANS: Record<CandidatePlanKey, CandidatePlanConfig> = {
  free: {
    audience: 'candidate',
    planKey: 'free',
    features: {
      alerts_basic: true,
      alerts_personalized: false,
      profile_boost_local: false,
      profile_boost_priority: false,
      premium_badge: false,
      profile_view_stats: false,
      priority_new_jobs: false,
      exclusive_jobs_early_access: false,
      ai_cv_assist: false,
      career_coaching: false,
      support_priority: false,
      support_vip: false,
      application_history_detailed: false,
    },
    limits: {
      max_applications_per_month: null,
      max_saved_jobs: 10,
      max_stored_cvs: 2,
    },
    billing: {
      priceMonthly: 0,
      currency: 'USD',
      label: 'Free',
    },
  },
  starter: {
    audience: 'candidate',
    planKey: 'starter',
    features: {
      alerts_basic: true,
      alerts_personalized: true,
      profile_boost_local: true,
      profile_boost_priority: false,
      premium_badge: false,
      profile_view_stats: false,
      priority_new_jobs: false,
      exclusive_jobs_early_access: false,
      ai_cv_assist: false,
      career_coaching: false,
      support_priority: false,
      support_vip: false,
      application_history_detailed: true,
    },
    limits: {
      max_applications_per_month: null,
      max_saved_jobs: 30,
      max_stored_cvs: 5,
    },
    billing: {
      priceMonthly: 4.99,
      currency: 'USD',
      label: 'Starter',
    },
  },
  pro: {
    audience: 'candidate',
    planKey: 'pro',
    features: {
      alerts_basic: true,
      alerts_personalized: true,
      profile_boost_local: true,
      profile_boost_priority: true,
      premium_badge: true,
      profile_view_stats: true,
      priority_new_jobs: true,
      exclusive_jobs_early_access: false,
      ai_cv_assist: false,
      career_coaching: false,
      support_priority: true,
      support_vip: false,
      application_history_detailed: true,
    },
    limits: {
      max_applications_per_month: null,
      max_saved_jobs: 100,
      max_stored_cvs: 10,
    },
    billing: {
      priceMonthly: 9.99,
      currency: 'USD',
      label: 'Pro',
    },
  },
  elite: {
    audience: 'candidate',
    planKey: 'elite',
    features: {
      alerts_basic: true,
      alerts_personalized: true,
      profile_boost_local: true,
      profile_boost_priority: true,
      premium_badge: true,
      profile_view_stats: true,
      priority_new_jobs: true,
      exclusive_jobs_early_access: true,
      ai_cv_assist: true,
      career_coaching: true,
      support_priority: true,
      support_vip: true,
      application_history_detailed: true,
    },
    limits: {
      max_applications_per_month: null,
      max_saved_jobs: null,
      max_stored_cvs: null,
    },
    billing: {
      priceMonthly: 19.99,
      currency: 'USD',
      label: 'Elite',
    },
  },
};

export const DEFAULT_CANDIDATE_PLAN_KEY: CandidatePlanKey = 'free';
