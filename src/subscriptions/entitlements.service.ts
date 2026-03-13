import { CACHE_MANAGER } from '@nestjs/cache-manager';
import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Cache } from 'cache-manager';
import { User, UserRole } from 'src/users/users.entity';
import { Between, Repository } from 'typeorm';
import { Job } from 'src/jobs/entities/job.entity';
import { JobStatus } from 'src/jobs/entities/job.entity';
import { JobRefreshEvent } from 'src/jobs/entities/job-refresh-event.entity';
import { SavedCandidate } from 'src/saved_candidate/entities/saved_candidate.entity';
import { Application } from 'src/applications/entities/application.entity';
import { JobBookmark } from 'src/job-bookmark/entities/job-bookmark.entity';
import { CandidateResume } from 'src/candidate-profile/entities/candidate-resume.entity';
import {
  CANDIDATE_PLANS,
  DEFAULT_CANDIDATE_PLAN_KEY,
  DEFAULT_EMPLOYER_PLAN_KEY,
  EMPLOYER_PLANS,
} from './plans.config';
import { BillingInvoice } from './billing-invoice.entity';
import { InvoicePdfService } from './invoice-pdf.service';
import { LimitReachedException } from './billing.errors';
import { SubscriptionEvent } from './subscription-events.entity';
import { Subscription } from './subscription.entity';
import type {
  CandidateEntitlements,
  CandidateBillingSnapshot,
  CandidateFeatureKey,
  CandidateLimitKey,
  CandidatePlanKey,
  EmployerEntitlements,
  EmployerBillingSnapshot,
  EmployerFeatureKey,
  EmployerLimitKey,
  EmployerPlanKey,
  UsageCounter,
  BillingSnapshot,
  SubscriptionEntitlements,
} from './subscription.types';
import {
  FeatureNotIncludedException,
  SubscriptionInactiveException,
} from './billing.errors';

const SUBSCRIPTION_CACHE_TTL_MS = 30_000;

@Injectable()
export class EntitlementsService {
  constructor(
    @InjectRepository(Subscription)
    private readonly subscriptionsRepo: Repository<Subscription>,
    @InjectRepository(SubscriptionEvent)
    private readonly subscriptionEventsRepo: Repository<SubscriptionEvent>,
    @InjectRepository(BillingInvoice)
    private readonly billingInvoicesRepo: Repository<BillingInvoice>,
    private readonly invoicePdf: InvoicePdfService,
    @InjectRepository(User)
    private readonly usersRepo: Repository<User>,
    @InjectRepository(Job)
    private readonly jobsRepo: Repository<Job>,
    @InjectRepository(SavedCandidate)
    private readonly savedCandidatesRepo: Repository<SavedCandidate>,
    @InjectRepository(Application)
    private readonly applicationsRepo: Repository<Application>,
    @InjectRepository(JobBookmark)
    private readonly bookmarksRepo: Repository<JobBookmark>,
    @InjectRepository(CandidateResume)
    private readonly resumesRepo: Repository<CandidateResume>,
    @InjectRepository(JobRefreshEvent)
    private readonly jobRefreshEventsRepo: Repository<JobRefreshEvent>,
    @Inject(CACHE_MANAGER) private readonly cache: Cache,
  ) {}

  async getEntitlements(userId: number): Promise<SubscriptionEntitlements> {
    const user = await this.usersRepo.findOne({
      where: { id: userId },
      select: ['id', 'role'],
    });

    if (!user) {
      return this.buildEmployerEntitlements(DEFAULT_EMPLOYER_PLAN_KEY);
    }

    return user.role === 'employer'
      ? this.getEmployerEntitlements(user.id)
      : this.getCandidateEntitlements(user.id);
  }

  async getBillingSnapshot(userId: number): Promise<BillingSnapshot> {
    const user = await this.usersRepo.findOne({
      where: { id: userId },
      select: ['id', 'role'],
    });

    if (!user || user.role === 'employer') {
      return this.getEmployerBillingSnapshot(userId);
    }

    return this.getCandidateBillingSnapshot(userId);
  }

  async getEmployerEntitlements(
    tenantId: number,
  ): Promise<EmployerEntitlements> {
    const cacheKey = this.getCacheKey('employer', tenantId);
    const cached = await this.cache.get<EmployerEntitlements>(cacheKey);
    if (cached) return cached;

    const tenant = await this.usersRepo.findOne({
      where: { id: tenantId, role: 'employer' },
      select: ['id', 'role'],
    });

    if (!tenant) {
      const fallback = this.buildEmployerEntitlements(DEFAULT_EMPLOYER_PLAN_KEY);
      await this.cache.set(cacheKey, fallback, SUBSCRIPTION_CACHE_TTL_MS);
      return fallback;
    }

    const subscription = await this.subscriptionsRepo.findOne({
      where: {
        tenant: { id: tenantId },
        audience: 'employer',
      },
      order: { updatedAt: 'DESC' },
      relations: ['tenant'],
    });

    const entitlements = this.resolveEmployerEntitlements(subscription);
    await this.cache.set(cacheKey, entitlements, SUBSCRIPTION_CACHE_TTL_MS);
    return entitlements;
  }

  async getCandidateEntitlements(
    tenantId: number,
  ): Promise<CandidateEntitlements> {
    const cacheKey = this.getCacheKey('candidate', tenantId);
    const cached = await this.cache.get<CandidateEntitlements>(cacheKey);
    if (cached) return cached;

    const tenant = await this.usersRepo.findOne({
      where: { id: tenantId, role: 'candidat' },
      select: ['id', 'role'],
    });

    if (!tenant) {
      const fallback = this.buildCandidateEntitlements(DEFAULT_CANDIDATE_PLAN_KEY);
      await this.cache.set(cacheKey, fallback, SUBSCRIPTION_CACHE_TTL_MS);
      return fallback;
    }

    const subscription = await this.subscriptionsRepo.findOne({
      where: {
        tenant: { id: tenantId },
        audience: 'candidate',
      },
      order: { updatedAt: 'DESC' },
      relations: ['tenant'],
    });

    const entitlements = this.resolveCandidateEntitlements(subscription);
    await this.cache.set(cacheKey, entitlements, SUBSCRIPTION_CACHE_TTL_MS);
    return entitlements;
  }

  async choosePlanForUser(
    userId: number,
    role: UserRole,
    planKey: string,
  ): Promise<SubscriptionEntitlements> {
    if (role === 'employer') {
      const safePlanKey = this.asEmployerPlanKey(planKey);
      await this.trackEvent(userId, 'plan_selected', {
        audience: 'employer',
        planKey: safePlanKey,
      });
      const result = await this.saveSubscription(
        userId,
        'employer',
        safePlanKey,
      );
      await this.createInvoiceForPlanChange(userId, 'employer', safePlanKey, result);
      await this.trackEvent(userId, 'upgrade_completed', {
        audience: 'employer',
        planKey: safePlanKey,
      });
      return this.resolveEmployerEntitlements(result);
    }

    const safePlanKey = this.asCandidatePlanKey(planKey);
    await this.trackEvent(userId, 'plan_selected', {
      audience: 'candidate',
      planKey: safePlanKey,
    });
    const result = await this.saveSubscription(userId, 'candidate', safePlanKey);
    await this.createInvoiceForPlanChange(userId, 'candidate', safePlanKey, result);
    await this.trackEvent(userId, 'upgrade_completed', {
      audience: 'candidate',
      planKey: safePlanKey,
    });
    return this.resolveCandidateEntitlements(result);
  }

  async cancelPlanForUser(
    userId: number,
    role: UserRole,
  ): Promise<SubscriptionEntitlements> {
    const audience = role === 'employer' ? 'employer' : 'candidate';
    const subscription = await this.subscriptionsRepo.findOne({
      where: { tenant: { id: userId }, audience },
      relations: ['tenant'],
    });

    if (!subscription) {
      return role === 'employer'
        ? this.getEmployerEntitlements(userId)
        : this.getCandidateEntitlements(userId);
    }

    subscription.status = 'canceled';
    subscription.canceledAt = new Date();
    const saved = await this.subscriptionsRepo.save(subscription);
    await this.clearEntitlementsCache(audience, userId);

    return role === 'employer'
      ? this.resolveEmployerEntitlements(saved)
      : this.resolveCandidateEntitlements(saved);
  }

  async assertEmployerFeature(
    tenantId: number,
    feature: EmployerFeatureKey,
  ): Promise<EmployerEntitlements> {
    const entitlements = await this.getEmployerEntitlements(tenantId);
    this.ensureActive(entitlements);

    if (!entitlements.features[feature]) {
      throw new FeatureNotIncludedException(entitlements.planKey, feature);
    }

    return entitlements;
  }

  async assertCandidateFeature(
    tenantId: number,
    feature: CandidateFeatureKey,
  ): Promise<CandidateEntitlements> {
    const entitlements = await this.getCandidateEntitlements(tenantId);
    this.ensureActive(entitlements);

    if (!entitlements.features[feature]) {
      throw new FeatureNotIncludedException(entitlements.planKey, feature);
    }

    return entitlements;
  }

  async assertEmployerLimit(
    tenantId: number,
    limitKey: EmployerLimitKey,
    current: number,
  ): Promise<EmployerEntitlements> {
    const entitlements = await this.getEmployerEntitlements(tenantId);
    this.ensureActive(entitlements);
    await this.ensureWithinLimit(tenantId, entitlements, limitKey, current);
    return entitlements;
  }

  async assertEmployerMonthlyActionLimit(
    tenantId: number,
    limitKey:
      | 'max_job_refreshes_per_month'
      | 'max_contacted_candidates_per_month',
  ): Promise<EmployerEntitlements> {
    const entitlements = await this.getEmployerEntitlements(tenantId);
    this.ensureActive(entitlements);

    const monthWhere = this.getMonthBetweenClause();
    let current = 0;

    if (limitKey === 'max_job_refreshes_per_month') {
      current = await this.jobRefreshEventsRepo.count({
        where: { employerId: tenantId, createdAt: monthWhere },
      });
    } else if (limitKey === 'max_contacted_candidates_per_month') {
      current = await this.subscriptionEventsRepo.count({
        where: {
          tenant: { id: tenantId },
          eventName: 'employer_candidate_contacted',
          createdAt: monthWhere,
        },
      });
    }

    await this.ensureWithinLimit(tenantId, entitlements, limitKey, current);

    return entitlements;
  }

  async trackEmployerMeteredEvent(
    tenantId: number,
    eventName: 'employer_candidate_contacted',
    payload: Record<string, unknown> = {},
  ) {
    const entitlements = await this.getEmployerEntitlements(tenantId);
    await this.trackEvent(tenantId, eventName, {
      audience: entitlements.audience,
      planKey: entitlements.planKey,
      ...payload,
    });
  }

  async assertCandidateLimit(
    tenantId: number,
    limitKey: CandidateLimitKey,
    current: number,
  ): Promise<CandidateEntitlements> {
    const entitlements = await this.getCandidateEntitlements(tenantId);
    this.ensureActive(entitlements);
    await this.ensureWithinLimit(tenantId, entitlements, limitKey, current);
    return entitlements;
  }

  async clearEmployerEntitlementsCache(tenantId: number) {
    await this.clearEntitlementsCache('employer', tenantId);
  }

  async clearCandidateEntitlementsCache(tenantId: number) {
    await this.clearEntitlementsCache('candidate', tenantId);
  }

  async getEmployerBillingSnapshot(
    tenantId: number,
  ): Promise<EmployerBillingSnapshot> {
    const entitlements = await this.getEmployerEntitlements(tenantId);
    const monthWhere = this.getMonthBetweenClause();
    const [
      activeJobs,
      savedCandidates,
      featuredJobs,
      jobRefreshesThisMonth,
      contactedCandidatesThisMonth,
    ] = await Promise.all([
      this.jobsRepo.count({
        where: { employer: { id: tenantId }, status: JobStatus.ACTIVE },
      }),
      this.savedCandidatesRepo.count({
        where: { employer: { id: tenantId } },
      }),
      this.jobsRepo.count({
        where: { employer: { id: tenantId }, isFeatured: true },
      }),
      this.jobRefreshEventsRepo.count({
        where: { employerId: tenantId, createdAt: monthWhere },
      }),
      this.subscriptionEventsRepo.count({
        where: {
          tenant: { id: tenantId },
          eventName: 'employer_candidate_contacted',
          createdAt: monthWhere,
        },
      }),
    ]);

    return {
      ...entitlements,
      usage: {
        max_active_jobs: this.makeUsageCounter(
          activeJobs,
          entitlements.limits.max_active_jobs,
        ),
        max_saved_candidates: this.makeUsageCounter(
          savedCandidates,
          entitlements.limits.max_saved_candidates,
        ),
        max_featured_jobs: this.makeUsageCounter(
          featuredJobs,
          entitlements.limits.max_featured_jobs,
        ),
        max_job_refreshes_per_month: this.makeUsageCounter(
          jobRefreshesThisMonth,
          entitlements.limits.max_job_refreshes_per_month,
        ),
        max_contacted_candidates_per_month: this.makeUsageCounter(
          contactedCandidatesThisMonth,
          entitlements.limits.max_contacted_candidates_per_month,
        ),
      },
    };
  }

  async getCandidateBillingSnapshot(
    tenantId: number,
  ): Promise<CandidateBillingSnapshot> {
    const entitlements = await this.getCandidateEntitlements(tenantId);
    const [applicationsThisMonth, savedJobs, storedCvs] = await Promise.all([
      this.applicationsRepo.count({
        where: {
          candidate: { id: tenantId },
          createdAt: this.getMonthBetweenClause(),
        },
      }),
      this.bookmarksRepo.count({ where: { userId: tenantId } }),
      this.resumesRepo.count({ where: { userId: tenantId } }),
    ]);

    return {
      ...entitlements,
      usage: {
        max_applications_per_month: this.makeUsageCounter(
          applicationsThisMonth,
          entitlements.limits.max_applications_per_month,
        ),
        max_saved_jobs: this.makeUsageCounter(
          savedJobs,
          entitlements.limits.max_saved_jobs,
        ),
        max_stored_cvs: this.makeUsageCounter(
          storedCvs,
          entitlements.limits.max_stored_cvs,
        ),
      },
    };
  }

  async getBillingHistory(userId: number, role: UserRole) {
    const audience = role === 'employer' ? 'employer' : 'candidate';
    const invoices = await this.billingInvoicesRepo.find({
      where: { tenant: { id: userId }, audience },
      order: { issuedAt: 'DESC', createdAt: 'DESC' },
    });

    return {
      items: invoices.map((invoice) => ({
        id: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        audience: invoice.audience,
        planKey: invoice.planKey,
        description: invoice.description,
        amount: Number(invoice.amount),
        currency: invoice.currency,
        status: invoice.status,
        provider: invoice.provider,
        providerRef: invoice.providerRef,
        periodStart: invoice.periodStart,
        periodEnd: invoice.periodEnd,
        issuedAt: invoice.issuedAt,
        paidAt: invoice.paidAt,
        metadata: invoice.metadata,
        receiptAvailable: true,
        receiptUrl: `/billing/history/${invoice.id}/receipt.pdf`,
      })),
      total: invoices.length,
    };
  }

  async getBillingReceiptPdf(
    userId: number,
    role: UserRole,
    invoiceId: number,
  ) {
    const audience = role === 'employer' ? 'employer' : 'candidate';
    const invoice = await this.billingInvoicesRepo.findOne({
      where: { id: invoiceId },
      relations: ['tenant'],
    });

    if (!invoice) {
      throw new NotFoundException('Invoice not found');
    }

    if (invoice.tenant?.id !== userId || invoice.audience !== audience) {
      throw new ForbiddenException('You do not own this invoice');
    }

    const customer = await this.usersRepo.findOne({
      where: { id: userId },
      select: ['id', 'name', 'email'],
    });

    const buffer = this.invoicePdf.generate({
      invoiceNumber: invoice.invoiceNumber,
      issuedAt: invoice.issuedAt,
      description: invoice.description,
      amount: Number(invoice.amount),
      currency: invoice.currency,
      status: invoice.status,
      audience: invoice.audience,
      planKey: invoice.planKey,
      customerName: customer?.name ?? 'Unknown customer',
      customerEmail: customer?.email ?? '-',
      periodStart: invoice.periodStart,
      periodEnd: invoice.periodEnd,
      provider: invoice.provider,
    });

    return {
      filename: `${invoice.invoiceNumber}.pdf`,
      buffer,
    };
  }

  getCurrentMonthRange(now = new Date()) {
    const start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
    const end = new Date(
      now.getFullYear(),
      now.getMonth() + 1,
      0,
      23,
      59,
      59,
      999,
    );
    return { start, end };
  }

  getMonthBetweenClause(now = new Date()) {
    const { start, end } = this.getCurrentMonthRange(now);
    return Between(start, end);
  }

  private async saveSubscription(
    userId: number,
    audience: 'employer' | 'candidate',
    planKey: EmployerPlanKey | CandidatePlanKey,
  ) {
    const existing = await this.subscriptionsRepo.findOne({
      where: { tenant: { id: userId }, audience },
      relations: ['tenant'],
    });

    const startedAt = new Date();
    const currentPeriodEnd =
      planKey === 'free'
        ? null
        : new Date(startedAt.getTime() + 30 * 24 * 60 * 60 * 1000);

    const subscription = existing ?? this.subscriptionsRepo.create();
    subscription.tenant = { id: userId } as User;
    subscription.audience = audience;
    subscription.planKey = planKey;
    subscription.status = 'active';
    subscription.startedAt = startedAt;
    subscription.currentPeriodEnd = currentPeriodEnd;
    subscription.canceledAt = null;

    const saved = await this.subscriptionsRepo.save(subscription);
    await this.clearEntitlementsCache(audience, userId);
    return saved;
  }

  private resolveEmployerEntitlements(
    subscription?: Subscription | null,
  ): EmployerEntitlements {
    if (!subscription) {
      return this.buildEmployerEntitlements(DEFAULT_EMPLOYER_PLAN_KEY);
    }

    const planKey = this.getSafeEmployerPlanKey(subscription.planKey);
    if (subscription.status === 'active' || subscription.status === 'trialing') {
      return this.buildEmployerEntitlements(
        planKey,
        subscription.status,
        subscription.startedAt,
        subscription.currentPeriodEnd,
      );
    }

    const fallback = this.buildEmployerEntitlements(DEFAULT_EMPLOYER_PLAN_KEY);
    return {
      ...fallback,
      status: subscription.status,
      startedAt: subscription.startedAt,
      currentPeriodEnd: subscription.currentPeriodEnd,
    };
  }

  private resolveCandidateEntitlements(
    subscription?: Subscription | null,
  ): CandidateEntitlements {
    if (!subscription) {
      return this.buildCandidateEntitlements(DEFAULT_CANDIDATE_PLAN_KEY);
    }

    const planKey = this.getSafeCandidatePlanKey(subscription.planKey);
    if (subscription.status === 'active' || subscription.status === 'trialing') {
      return this.buildCandidateEntitlements(
        planKey,
        subscription.status,
        subscription.startedAt,
        subscription.currentPeriodEnd,
      );
    }

    const fallback = this.buildCandidateEntitlements(DEFAULT_CANDIDATE_PLAN_KEY);
    return {
      ...fallback,
      status: subscription.status,
      startedAt: subscription.startedAt,
      currentPeriodEnd: subscription.currentPeriodEnd,
    };
  }

  private buildEmployerEntitlements(
    planKey: EmployerPlanKey,
    status: EmployerEntitlements['status'] = 'active',
    startedAt: Date | null = null,
    currentPeriodEnd: Date | null = null,
  ): EmployerEntitlements {
    const plan = EMPLOYER_PLANS[planKey];
    return {
      audience: 'employer',
      planKey: plan.planKey,
      status,
      startedAt,
      currentPeriodEnd,
      features: { ...plan.features },
      limits: { ...plan.limits },
    };
  }

  private buildCandidateEntitlements(
    planKey: CandidatePlanKey,
    status: CandidateEntitlements['status'] = 'active',
    startedAt: Date | null = null,
    currentPeriodEnd: Date | null = null,
  ): CandidateEntitlements {
    const plan = CANDIDATE_PLANS[planKey];
    return {
      audience: 'candidate',
      planKey: plan.planKey,
      status,
      startedAt,
      currentPeriodEnd,
      features: { ...plan.features },
      limits: { ...plan.limits },
    };
  }

  private async ensureWithinLimit(
    tenantId: number,
    entitlements: SubscriptionEntitlements,
    limitKey: string,
    current: number,
  ) {
    const limit = (entitlements.limits as Record<string, number | null>)[limitKey];
    if (limit !== null && current >= limit) {
      await this.trackEvent(tenantId, 'limit_hit', {
        audience: entitlements.audience,
        planKey: entitlements.planKey,
        limitKey,
        limit,
        current,
      });
      throw new LimitReachedException(entitlements.planKey, limitKey as never, limit, current);
    }
  }

  private ensureActive(entitlements: SubscriptionEntitlements) {
    if (entitlements.status !== 'active') {
      throw new SubscriptionInactiveException(
        entitlements.planKey,
        entitlements.status,
      );
    }
  }

  private getSafeEmployerPlanKey(planKey: string): EmployerPlanKey {
    return planKey in EMPLOYER_PLANS
      ? (planKey as EmployerPlanKey)
      : DEFAULT_EMPLOYER_PLAN_KEY;
  }

  private getSafeCandidatePlanKey(planKey: string): CandidatePlanKey {
    return planKey in CANDIDATE_PLANS
      ? (planKey as CandidatePlanKey)
      : DEFAULT_CANDIDATE_PLAN_KEY;
  }

  private asEmployerPlanKey(planKey: string): EmployerPlanKey {
    if (!(planKey in EMPLOYER_PLANS)) {
      throw new BadRequestException('Invalid employer plan');
    }
    return planKey as EmployerPlanKey;
  }

  private asCandidatePlanKey(planKey: string): CandidatePlanKey {
    if (!(planKey in CANDIDATE_PLANS)) {
      throw new BadRequestException('Invalid candidate plan');
    }
    return planKey as CandidatePlanKey;
  }

  private getCacheKey(audience: 'employer' | 'candidate', tenantId: number) {
    return `${audience}-entitlements:${tenantId}`;
  }

  private async clearEntitlementsCache(
    audience: 'employer' | 'candidate',
    tenantId: number,
  ) {
    await this.cache.del(this.getCacheKey(audience, tenantId));
  }

  private async trackEvent(
    tenantId: number,
    eventName: string,
    payload: Record<string, unknown>,
  ) {
    await this.subscriptionEventsRepo.save(
      this.subscriptionEventsRepo.create({
        tenant: { id: tenantId } as User,
        eventName,
        payload,
      }),
    );
  }

  private makeUsageCounter(current: number, limit: number | null): UsageCounter {
    return {
      current,
      limit,
      remaining: limit === null ? null : Math.max(limit - current, 0),
    };
  }

  private async createInvoiceForPlanChange(
    userId: number,
    audience: 'employer' | 'candidate',
    planKey: EmployerPlanKey | CandidatePlanKey,
    subscription: Subscription,
  ) {
    const plan =
      audience === 'employer'
        ? EMPLOYER_PLANS[planKey as EmployerPlanKey]
        : CANDIDATE_PLANS[planKey as CandidatePlanKey];

    const issuedAt = new Date();
    const amount = plan.billing.priceMonthly.toFixed(2);
    const invoiceNumber = this.makeInvoiceNumber(audience, issuedAt);

    await this.billingInvoicesRepo.save(
      this.billingInvoicesRepo.create({
        tenant: { id: userId } as User,
        audience,
        planKey,
        invoiceNumber,
        description:
          amount === '0.00'
            ? `${plan.billing.label} plan activation`
            : `${plan.billing.label} monthly subscription`,
        amount,
        currency: plan.billing.currency,
        status: 'paid',
        periodStart: subscription.startedAt,
        periodEnd: subscription.currentPeriodEnd,
        provider: 'sandbox',
        providerRef: null,
        metadata: {
          sandbox: true,
          triggeredBy: 'choose_plan',
        },
        issuedAt,
        paidAt: issuedAt,
      }),
    );
  }

  private makeInvoiceNumber(
    audience: 'employer' | 'candidate',
    issuedAt: Date,
  ) {
    const stamp = issuedAt.toISOString().replace(/[-:.TZ]/g, '').slice(0, 14);
    const suffix = Math.random().toString(36).slice(2, 8).toUpperCase();
    return `INV-${audience.slice(0, 3).toUpperCase()}-${stamp}-${suffix}`;
  }
}
