import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Application } from 'src/applications/entities/application.entity';
import { CandidateResume } from 'src/candidate-profile/entities/candidate-resume.entity';
import { JobBookmark } from 'src/job-bookmark/entities/job-bookmark.entity';
import { Job } from 'src/jobs/entities/job.entity';
import { SavedCandidate } from 'src/saved_candidate/entities/saved_candidate.entity';
import { User } from 'src/users/users.entity';
import { BillingInvoice } from './billing-invoice.entity';
import { InvoicePdfService } from './invoice-pdf.service';
import { SubscriptionEvent } from './subscription-events.entity';
import { Subscription } from './subscription.entity';
import { EntitlementsService } from './entitlements.service';

describe('EntitlementsService', () => {
  let service: EntitlementsService;
  const subscriptionsRepo = {
    findOne: jest.fn(),
    save: jest.fn(),
    create: jest.fn(),
  };
  const subscriptionEventsRepo = {
    save: jest.fn(),
    create: jest.fn((value) => value),
  };
  const usersRepo = {
    findOne: jest.fn(),
  };
  const jobsRepo = { count: jest.fn() };
  const savedCandidatesRepo = { count: jest.fn() };
  const applicationsRepo = { count: jest.fn() };
  const bookmarksRepo = { count: jest.fn() };
  const resumesRepo = { count: jest.fn() };
  const billingInvoicesRepo = {
    find: jest.fn(),
    findOne: jest.fn(),
    save: jest.fn(),
    create: jest.fn((value) => value),
  };
  const invoicePdf = {
    generate: jest.fn(),
  };
  const cache = {
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EntitlementsService,
        { provide: getRepositoryToken(Subscription), useValue: subscriptionsRepo },
        { provide: getRepositoryToken(SubscriptionEvent), useValue: subscriptionEventsRepo },
        { provide: getRepositoryToken(User), useValue: usersRepo },
        { provide: getRepositoryToken(Job), useValue: jobsRepo },
        { provide: getRepositoryToken(SavedCandidate), useValue: savedCandidatesRepo },
        { provide: getRepositoryToken(Application), useValue: applicationsRepo },
        { provide: getRepositoryToken(JobBookmark), useValue: bookmarksRepo },
        { provide: getRepositoryToken(CandidateResume), useValue: resumesRepo },
        { provide: getRepositoryToken(BillingInvoice), useValue: billingInvoicesRepo },
        { provide: InvoicePdfService, useValue: invoicePdf },
        { provide: CACHE_MANAGER, useValue: cache },
      ],
    }).compile();

    service = module.get<EntitlementsService>(EntitlementsService);
  });

  it('falls back to the free employer plan when no subscription exists', async () => {
    cache.get.mockResolvedValue(undefined);
    usersRepo.findOne.mockResolvedValue({ id: 3, role: 'employer' });
    subscriptionsRepo.findOne.mockResolvedValue(null);

    const result = await service.getEmployerEntitlements(3);

    expect(result.planKey).toBe('free');
    expect(result.features.analytics_basic).toBe(true);
    expect(result.features.analytics_advanced).toBe(false);
    expect(result.limits.max_active_jobs).toBe(1);
  });

  it('returns the active subscription entitlements when a plan exists', async () => {
    cache.get.mockResolvedValue(undefined);
    usersRepo.findOne.mockResolvedValue({ id: 3, role: 'employer' });
    subscriptionsRepo.findOne.mockResolvedValue({
      planKey: 'standard',
      status: 'active',
      startedAt: new Date('2026-03-01T00:00:00.000Z'),
      currentPeriodEnd: new Date('2026-03-31T00:00:00.000Z'),
    });

    const result = await service.getEmployerEntitlements(3);

    expect(result.planKey).toBe('standard');
    expect(result.features.analytics_advanced).toBe(true);
    expect(result.features.analytics_benchmark).toBe(false);
    expect(result.limits.max_saved_candidates).toBe(25);
  });

  it('falls back to free features but preserves inactive status', async () => {
    cache.get.mockResolvedValue(undefined);
    usersRepo.findOne.mockResolvedValue({ id: 3, role: 'employer' });
    subscriptionsRepo.findOne.mockResolvedValue({
      planKey: 'premium',
      status: 'canceled',
      startedAt: new Date('2026-03-01T00:00:00.000Z'),
      currentPeriodEnd: new Date('2026-03-31T00:00:00.000Z'),
    });

    const result = await service.getEmployerEntitlements(3);

    expect(result.planKey).toBe('free');
    expect(result.status).toBe('canceled');
    expect(result.features.export_enabled).toBe(false);
  });

  it('returns candidate entitlements for candidate users', async () => {
    cache.get.mockResolvedValue(undefined);
    usersRepo.findOne.mockResolvedValue({ id: 7, role: 'candidat' });
    subscriptionsRepo.findOne.mockResolvedValue({
      planKey: 'pro',
      status: 'active',
      startedAt: new Date('2026-03-01T00:00:00.000Z'),
      currentPeriodEnd: new Date('2026-03-31T00:00:00.000Z'),
    });

    const result = await service.getCandidateEntitlements(7);

    expect(result.planKey).toBe('pro');
    expect(result.features.premium_badge).toBe(true);
    expect(result.limits.max_applications_per_month).toBe(100);
  });

  it('chooses the audience from the user role for shared billing access', async () => {
    usersRepo.findOne
      .mockResolvedValueOnce({ id: 7, role: 'candidat' })
      .mockResolvedValueOnce({ id: 7, role: 'candidat' });
    cache.get.mockResolvedValue(undefined);
    subscriptionsRepo.findOne.mockResolvedValue(null);

    const result = await service.getEntitlements(7);

    expect(result.audience).toBe('candidate');
    expect(result.planKey).toBe('free');
  });

  it('builds employer billing usage counters with remaining values', async () => {
    cache.get.mockResolvedValue(undefined);
    usersRepo.findOne.mockResolvedValue({ id: 3, role: 'employer' });
    subscriptionsRepo.findOne.mockResolvedValue(null);
    jobsRepo.count.mockResolvedValue(1);
    savedCandidatesRepo.count.mockResolvedValue(2);

    const result = await service.getEmployerBillingSnapshot(3);

    expect(result.usage.max_active_jobs).toEqual({
      current: 1,
      limit: 1,
      remaining: 0,
    });
    expect(result.usage.max_saved_candidates).toEqual({
      current: 2,
      limit: 3,
      remaining: 1,
    });
  });

  it('builds candidate billing usage counters with unlimited remaining as null', async () => {
    cache.get.mockResolvedValue(undefined);
    usersRepo.findOne.mockResolvedValue({ id: 7, role: 'candidat' });
    subscriptionsRepo.findOne.mockResolvedValue({
      planKey: 'elite',
      status: 'active',
      startedAt: new Date('2026-03-01T00:00:00.000Z'),
      currentPeriodEnd: new Date('2026-03-31T00:00:00.000Z'),
    });
    applicationsRepo.count.mockResolvedValue(5);
    bookmarksRepo.count.mockResolvedValue(12);
    resumesRepo.count.mockResolvedValue(3);

    const result = await service.getCandidateBillingSnapshot(7);

    expect(result.usage.max_applications_per_month.remaining).toBeNull();
    expect(result.usage.max_saved_jobs.remaining).toBeNull();
    expect(result.usage.max_stored_cvs.remaining).toBeNull();
  });

  it('creates a sandbox invoice when an employer plan is chosen', async () => {
    subscriptionsRepo.findOne
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        planKey: 'premium',
        status: 'active',
        startedAt: new Date('2026-03-01T00:00:00.000Z'),
        currentPeriodEnd: new Date('2026-03-31T00:00:00.000Z'),
      });
    subscriptionsRepo.create.mockReturnValue({});
    subscriptionsRepo.save.mockResolvedValue({
      planKey: 'premium',
      status: 'active',
      startedAt: new Date('2026-03-01T00:00:00.000Z'),
      currentPeriodEnd: new Date('2026-03-31T00:00:00.000Z'),
    });

    await service.choosePlanForUser(3, 'employer', 'premium');

    expect(billingInvoicesRepo.save).toHaveBeenCalled();
    expect(billingInvoicesRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        audience: 'employer',
        planKey: 'premium',
        amount: '29.99',
        currency: 'USD',
        provider: 'sandbox',
      }),
    );
  });

  it('returns billing history items for the current audience', async () => {
    billingInvoicesRepo.find.mockResolvedValue([
      {
        id: 1,
        invoiceNumber: 'INV-EMP-123',
        audience: 'employer',
        planKey: 'premium',
        description: 'Premium monthly subscription',
        amount: '29.99',
        currency: 'USD',
        status: 'paid',
        provider: 'sandbox',
        providerRef: null,
        periodStart: new Date('2026-03-01T00:00:00.000Z'),
        periodEnd: new Date('2026-03-31T00:00:00.000Z'),
        issuedAt: new Date('2026-03-01T00:00:00.000Z'),
        paidAt: new Date('2026-03-01T00:00:00.000Z'),
        metadata: { sandbox: true },
        createdAt: new Date('2026-03-01T00:00:00.000Z'),
      },
    ]);

    const result = await service.getBillingHistory(3, 'employer');

    expect(result.total).toBe(1);
    expect(result.items[0]).toMatchObject({
      invoiceNumber: 'INV-EMP-123',
      amount: 29.99,
      planKey: 'premium',
      status: 'paid',
      receiptAvailable: true,
      receiptUrl: '/billing/history/1/receipt.pdf',
    });
  });

  it('generates a receipt pdf for an owned invoice', async () => {
    billingInvoicesRepo.findOne.mockResolvedValue({
      id: 1,
      invoiceNumber: 'INV-EMP-123',
      audience: 'employer',
      planKey: 'premium',
      description: 'Premium monthly subscription',
      amount: '29.99',
      currency: 'USD',
      status: 'paid',
      provider: 'sandbox',
      tenant: { id: 3 },
      periodStart: new Date('2026-03-01T00:00:00.000Z'),
      periodEnd: new Date('2026-03-31T00:00:00.000Z'),
      issuedAt: new Date('2026-03-01T00:00:00.000Z'),
    });
    usersRepo.findOne.mockResolvedValue({
      id: 3,
      name: 'Acme',
      email: 'billing@acme.test',
    });
    invoicePdf.generate.mockReturnValue(Buffer.from('pdf'));

    const result = await service.getBillingReceiptPdf(3, 'employer', 1);

    expect(result.filename).toBe('INV-EMP-123.pdf');
    expect(result.buffer).toEqual(Buffer.from('pdf'));
    expect(invoicePdf.generate).toHaveBeenCalledWith(
      expect.objectContaining({
        invoiceNumber: 'INV-EMP-123',
        customerEmail: 'billing@acme.test',
        amount: 29.99,
      }),
    );
  });
});
