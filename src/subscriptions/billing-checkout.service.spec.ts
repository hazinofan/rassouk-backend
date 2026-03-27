import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { BadRequestException, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { User } from 'src/users/users.entity';
import { BillingCheckoutService } from './billing-checkout.service';
import { BillingInvoice } from './billing-invoice.entity';
import { BillingProviderPlan } from './billing-provider-plan.entity';
import { SubscriptionEvent } from './subscription-events.entity';
import { Subscription } from './subscription.entity';

describe('BillingCheckoutService', () => {
  let service: BillingCheckoutService;
  let fetchSpy: jest.SpiedFunction<typeof fetch>;

  const usersRepo = {
    findOne: jest.fn(),
  };
  const subscriptionsRepo = {
    findOne: jest.fn(),
    save: jest.fn(),
    create: jest.fn(() => ({})),
  };
  const billingInvoicesRepo = {
    findOne: jest.fn(),
    save: jest.fn(),
    create: jest.fn((value) => value),
  };
  const subscriptionEventsRepo = {
    save: jest.fn(),
    create: jest.fn((value) => value),
  };
  const billingProviderPlansRepo = {
    findOne: jest.fn(),
    save: jest.fn(),
    create: jest.fn((value) => value),
  };
  const cache = {
    del: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    fetchSpy = jest.spyOn(global, 'fetch');

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BillingCheckoutService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              const values: Record<string, string> = {
                STRIPE_SECRET_KEY: 'sk_test_123',
                STRIPE_WEBHOOK_SECRET: 'whsec_123',
                STRIPE_ENV: 'sandbox',
                WEB_URL: 'http://localhost:3000',
                PAYPAL_ENV: 'sandbox',
                PAYPAL_CLIENT_ID: 'paypal_client',
                PAYPAL_CLIENT_SECRET: 'paypal_secret',
              };
              return values[key];
            }),
          },
        },
        { provide: getRepositoryToken(User), useValue: usersRepo },
        { provide: getRepositoryToken(Subscription), useValue: subscriptionsRepo },
        { provide: getRepositoryToken(BillingInvoice), useValue: billingInvoicesRepo },
        {
          provide: getRepositoryToken(SubscriptionEvent),
          useValue: subscriptionEventsRepo,
        },
        {
          provide: getRepositoryToken(BillingProviderPlan),
          useValue: billingProviderPlansRepo,
        },
        { provide: CACHE_MANAGER, useValue: cache },
      ],
    }).compile();

    service = module.get<BillingCheckoutService>(BillingCheckoutService);
  });

  afterEach(() => {
    fetchSpy.mockRestore();
  });

  it('returns internal mode for free plans', async () => {
    const result = await service.createCheckoutSession({
      userId: 7,
      role: 'candidat',
      planKey: 'free',
      provider: 'stripe',
    });

    expect(result).toEqual({ mode: 'internal' });
    expect(usersRepo.findOne).not.toHaveBeenCalled();
  });

  it('rejects Stripe for paid plans', async () => {
    usersRepo.findOne.mockResolvedValue({
      id: 3,
      email: 'billing@acme.test',
      name: 'Acme Recruiter',
      role: 'employer',
    });

    await expect(
      service.createCheckoutSession({
        userId: 3,
        role: 'employer',
        planKey: 'premium',
        provider: 'stripe',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('rejects Stripe webhooks with an invalid signature', async () => {
    await expect(
      service.handleStripeWebhook(
        {
          headers: {
            'stripe-signature': 't=123,v1=invalid',
          },
        } as any,
        Buffer.from(JSON.stringify({ id: 'evt_1', type: 'invoice.paid' })),
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('fails PayPal webhooks when the webhook id is not configured', async () => {
    const config = (service as any).config as ConfigService;
    jest.spyOn(config, 'get').mockImplementation((key: string) => {
      if (key === 'PAYPAL_WEBHOOK_ID') {
        return undefined;
      }
      return undefined;
    });

    await expect(
      service.handlePaypalWebhook({ header: jest.fn() } as any, {}),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it('confirms PayPal checkout and activates canonical subscription state', async () => {
    subscriptionsRepo.findOne
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null);
    subscriptionsRepo.save.mockResolvedValue({
      id: 10,
      planKey: 'standard',
      status: 'active',
    });

    fetchSpy
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ access_token: 'token_123' }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 'I-TEST123',
          custom_id: '42:employer:standard',
          plan_id: 'P-TEST123',
          status: 'ACTIVE',
          billing_info: {
            next_billing_time: '2026-05-01T00:00:00Z',
          },
        }),
      } as Response);

    const result = await service.confirmPaypalCheckoutForUser({
      userId: 42,
      role: 'employer',
      token: 'I-TEST123',
    });

    expect(result).toEqual({
      received: true,
      provider: 'paypal',
      subscriptionId: 'I-TEST123',
      audience: 'employer',
      planKey: 'standard',
      status: 'active',
    });

    expect(subscriptionsRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        audience: 'employer',
        planKey: 'standard',
        status: 'active',
        provider: 'paypal',
        providerSubscriptionId: 'I-TEST123',
      }),
    );
    expect(cache.del).toHaveBeenCalledWith('employer-entitlements:42');
  });
});
