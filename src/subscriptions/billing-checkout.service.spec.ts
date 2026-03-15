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

  it('creates a Stripe checkout session for paid plans', async () => {
    usersRepo.findOne.mockResolvedValue({
      id: 3,
      email: 'billing@acme.test',
      name: 'Acme Recruiter',
      role: 'employer',
    });
    fetchSpy.mockResolvedValue({
      ok: true,
      json: async () => ({
        id: 'cs_test_123',
        url: 'https://checkout.stripe.com/c/pay/cs_test_123',
      }),
    } as Response);

    const result = await service.createCheckoutSession({
      userId: 3,
      role: 'employer',
      planKey: 'premium',
      provider: 'stripe',
    });

    expect(result).toEqual({
      mode: 'redirect',
      provider: 'stripe',
      checkoutId: 'cs_test_123',
      approvalUrl: 'https://checkout.stripe.com/c/pay/cs_test_123',
    });
    expect(fetchSpy).toHaveBeenCalledWith(
      'https://api.stripe.com/v1/checkout/sessions',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer sk_test_123',
        }),
      }),
    );
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
});
