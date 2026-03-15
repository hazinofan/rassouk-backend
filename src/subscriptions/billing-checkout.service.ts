import { CACHE_MANAGER } from '@nestjs/cache-manager';
import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { RawBodyRequest } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Cache } from 'cache-manager';
import { createHmac, timingSafeEqual } from 'crypto';
import type { Request } from 'express';
import { Repository } from 'typeorm';
import { User, UserRole } from 'src/users/users.entity';
import { BillingInvoice } from './billing-invoice.entity';
import { BillingProviderPlan } from './billing-provider-plan.entity';
import { CANDIDATE_PLANS, EMPLOYER_PLANS } from './plans.config';
import { SubscriptionEvent } from './subscription-events.entity';
import { Subscription } from './subscription.entity';
import type {
  BillingEnvironment,
  BillingProvider,
  CandidatePlanKey,
  EmployerPlanKey,
  PlanBillingConfig,
  PlanKey,
  SubscriptionAudience,
  SubscriptionStatus,
} from './subscription.types';

type CheckoutResult =
  | {
      mode: 'internal';
    }
  | {
      mode: 'redirect';
      provider: BillingProvider;
      checkoutId: string;
      approvalUrl: string;
    };

type PaypalWebhookVerificationResponse = {
  verification_status?: string;
};

@Injectable()
export class BillingCheckoutService {
  private readonly logger = new Logger(BillingCheckoutService.name);

  constructor(
    @InjectRepository(User)
    private readonly usersRepo: Repository<User>,
    @InjectRepository(Subscription)
    private readonly subscriptionsRepo: Repository<Subscription>,
    @InjectRepository(BillingInvoice)
    private readonly billingInvoicesRepo: Repository<BillingInvoice>,
    @InjectRepository(SubscriptionEvent)
    private readonly subscriptionEventsRepo: Repository<SubscriptionEvent>,
    @InjectRepository(BillingProviderPlan)
    private readonly billingProviderPlansRepo: Repository<BillingProviderPlan>,
    private readonly config: ConfigService,
    @Inject(CACHE_MANAGER) private readonly cache: Cache,
  ) {}

  async createCheckoutSession(params: {
    userId: number;
    role: UserRole;
    planKey: PlanKey;
    provider: BillingProvider;
    successUrl?: string;
    cancelUrl?: string;
    locale?: string;
  }): Promise<CheckoutResult> {
    const audience = this.getAudienceFromRole(params.role);
    const plan = this.getPlanConfig(audience, params.planKey);

    if (plan.billing.priceMonthly <= 0) {
      return { mode: 'internal' };
    }

    const user = await this.usersRepo.findOne({
      where: { id: params.userId },
      select: ['id', 'email', 'name', 'role'],
    });

    if (!user) {
      throw new BadRequestException('User not found');
    }

    if (params.provider === 'stripe') {
      return this.createStripeCheckoutSession({
        user,
        audience,
        planKey: params.planKey,
        plan: plan.billing,
        successUrl: params.successUrl,
        cancelUrl: params.cancelUrl,
      });
    }

    return this.createPaypalSubscription({
      user,
      audience,
      planKey: params.planKey,
      plan: plan.billing,
      successUrl: params.successUrl,
      cancelUrl: params.cancelUrl,
      locale: params.locale,
    });
  }

  async handleStripeWebhook(
    request: RawBodyRequest<Request>,
    rawBody?: Buffer,
  ) {
    const signature = request.headers['stripe-signature'];
    if (typeof signature !== 'string' || !rawBody) {
      throw new BadRequestException('Missing Stripe signature');
    }

    const webhookSecret = this.config.get<string>('STRIPE_WEBHOOK_SECRET');
    if (!webhookSecret) {
      throw new ServiceUnavailableException(
        'Stripe webhook secret is not configured',
      );
    }

    const event = this.verifyStripeSignature(rawBody, signature, webhookSecret);

    switch (event.type) {
      case 'checkout.session.completed':
        await this.handleStripeCheckoutCompleted(event.data?.object ?? {});
        break;
      case 'invoice.paid':
        await this.handleStripeInvoicePaid(event.data?.object ?? {});
        break;
      case 'invoice.payment_failed':
        await this.handleStripeInvoicePaymentFailed(event.data?.object ?? {});
        break;
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted':
        await this.handleStripeSubscriptionUpdated(event.data?.object ?? {});
        break;
      default:
        break;
    }

    return { received: true };
  }

  async handlePaypalWebhook(
    request: Request,
    body: Record<string, unknown>,
  ) {
    const webhookId = this.config.get<string>('PAYPAL_WEBHOOK_ID');
    if (!webhookId) {
      throw new ServiceUnavailableException('PayPal webhook id is not configured');
    }

    const isValid = await this.verifyPaypalWebhookSignature(request, body, webhookId);
    if (!isValid) {
      throw new BadRequestException('Invalid PayPal webhook signature');
    }

    const eventType = String(body.event_type ?? '');
    switch (eventType) {
      case 'BILLING.SUBSCRIPTION.ACTIVATED':
      case 'BILLING.SUBSCRIPTION.UPDATED':
        await this.handlePaypalSubscriptionActivated(body);
        break;
      case 'BILLING.SUBSCRIPTION.CANCELLED':
      case 'BILLING.SUBSCRIPTION.EXPIRED':
        await this.handlePaypalSubscriptionStatusChanged(body, 'canceled');
        break;
      case 'BILLING.SUBSCRIPTION.SUSPENDED':
      case 'BILLING.SUBSCRIPTION.PAYMENT.FAILED':
        await this.handlePaypalSubscriptionStatusChanged(body, 'past_due');
        break;
      case 'PAYMENT.SALE.COMPLETED':
      case 'BILLING.SUBSCRIPTION.PAYMENT.COMPLETED':
        await this.handlePaypalPaymentCompleted(body);
        break;
      default:
        break;
    }

    return { received: true };
  }

  private async createStripeCheckoutSession(params: {
    user: Pick<User, 'id' | 'email' | 'name' | 'role'>;
    audience: SubscriptionAudience;
    planKey: PlanKey;
    plan: PlanBillingConfig;
    successUrl?: string;
    cancelUrl?: string;
  }): Promise<CheckoutResult> {
    const secretKey = this.config.get<string>('STRIPE_SECRET_KEY');
    if (!secretKey) {
      throw new ServiceUnavailableException('Stripe is not configured');
    }

    const form = new URLSearchParams();
    form.set('mode', 'subscription');
    form.set(
      'success_url',
      this.resolveSuccessUrl(
        params.successUrl,
        'stripe',
        params.planKey,
        `${this.getPublicWebUrl()}/billing/success?provider=stripe&plan=${params.planKey}&session_id={CHECKOUT_SESSION_ID}`,
      ),
    );
    form.set(
      'cancel_url',
      this.resolveCancelUrl(
        params.cancelUrl,
        'stripe',
        params.planKey,
        `${this.getPublicWebUrl()}/billing/cancel?provider=stripe&plan=${params.planKey}`,
      ),
    );
    form.set('customer_email', params.user.email);
    form.set('client_reference_id', String(params.user.id));
    form.set('metadata[userId]', String(params.user.id));
    form.set('metadata[audience]', params.audience);
    form.set('metadata[planKey]', params.planKey);
    form.set('subscription_data[metadata][userId]', String(params.user.id));
    form.set('subscription_data[metadata][audience]', params.audience);
    form.set('subscription_data[metadata][planKey]', params.planKey);
    form.set('line_items[0][quantity]', '1');
    form.set('line_items[0][price_data][currency]', params.plan.currency.toLowerCase());
    form.set(
      'line_items[0][price_data][unit_amount]',
      String(this.priceToMinorUnits(params.plan.priceMonthly)),
    );
    form.set('line_items[0][price_data][recurring][interval]', 'month');
    form.set('line_items[0][price_data][product_data][name]', params.plan.productName);
    form.set(
      'line_items[0][price_data][product_data][description]',
      params.plan.productDescription,
    );

    const session = await this.stripeRequest<{
      id: string;
      url: string;
    }>('/v1/checkout/sessions', {
      method: 'POST',
      body: form,
    });

    return {
      mode: 'redirect',
      provider: 'stripe',
      checkoutId: session.id,
      approvalUrl: session.url,
    };
  }

  private async createPaypalSubscription(params: {
    user: Pick<User, 'id' | 'email' | 'name' | 'role'>;
    audience: SubscriptionAudience;
    planKey: PlanKey;
    plan: PlanBillingConfig;
    successUrl?: string;
    cancelUrl?: string;
    locale?: string;
  }): Promise<CheckoutResult> {
    const environment = this.getPaypalEnvironment();
    const catalog = await this.ensurePaypalPlan(
      params.audience,
      params.planKey,
      params.plan,
    );
    const givenName = params.user.name?.split(' ')[0]?.slice(0, 140) || 'Customer';
    const surname =
      params.user.name?.split(' ').slice(1).join(' ').slice(0, 140) || 'User';
    const customId = `${params.user.id}:${params.audience}:${params.planKey}`;

    const subscription = await this.paypalRequest<{
      id: string;
      links?: Array<{ href: string; rel: string }>;
    }>('/v1/billing/subscriptions', {
      method: 'POST',
      body: {
        plan_id: catalog.externalPriceId,
        custom_id: customId,
        subscriber: {
          name: {
            given_name: givenName,
            surname,
          },
          email_address: params.user.email,
        },
        application_context: {
          brand_name: this.config.get<string>('PAYPAL_BRAND_NAME') ?? 'Bghit-Nkhdem',
          locale: params.locale ?? 'en-US',
          shipping_preference: 'NO_SHIPPING',
          user_action: 'SUBSCRIBE_NOW',
          payment_method: {
            payer_selected: 'PAYPAL',
            payee_preferred: 'IMMEDIATE_PAYMENT_REQUIRED',
          },
          return_url: this.resolveSuccessUrl(
            params.successUrl,
            'paypal',
            params.planKey,
            `${this.getPublicWebUrl()}/billing/success?provider=paypal&plan=${params.planKey}`,
          ),
          cancel_url: this.resolveCancelUrl(
            params.cancelUrl,
            'paypal',
            params.planKey,
            `${this.getPublicWebUrl()}/billing/cancel?provider=paypal&plan=${params.planKey}`,
          ),
        },
      },
    });

    const approvalUrl =
      subscription.links?.find((link) => link.rel === 'approve')?.href;

    if (!approvalUrl) {
      throw new ServiceUnavailableException(
        'PayPal did not return an approval link',
      );
    }

    await this.trackEventForUser(params.user.id, 'paypal_subscription_created', {
      audience: params.audience,
      environment,
      planKey: params.planKey,
      externalPlanId: catalog.externalPriceId,
      externalSubscriptionId: subscription.id,
    });

    return {
      mode: 'redirect',
      provider: 'paypal',
      checkoutId: subscription.id,
      approvalUrl,
    };
  }

  private async ensurePaypalPlan(
    audience: SubscriptionAudience,
    planKey: PlanKey,
    plan: PlanBillingConfig,
  ) {
    const environment = this.getPaypalEnvironment();
    const existing = await this.billingProviderPlansRepo.findOne({
      where: {
        provider: 'paypal',
        environment,
        audience,
        planKey,
      },
    });

    if (existing?.externalPriceId) {
      return existing;
    }

    const product = await this.paypalRequest<{ id: string }>('/v1/catalogs/products', {
      method: 'POST',
      body: {
        name: plan.productName,
        description: plan.productDescription,
        type: 'SERVICE',
        category: 'SOFTWARE',
      },
    });

    const externalPlan = await this.paypalRequest<{ id: string }>(
      '/v1/billing/plans',
      {
        method: 'POST',
        body: {
          product_id: product.id,
          name: `${plan.label} Monthly`,
          description: `${plan.productDescription} (${audience})`,
          status: 'ACTIVE',
          billing_cycles: [
            {
              frequency: {
                interval_unit: 'MONTH',
                interval_count: 1,
              },
              tenure_type: 'REGULAR',
              sequence: 1,
              total_cycles: 0,
              pricing_scheme: {
                fixed_price: {
                  value: plan.priceMonthly.toFixed(2),
                  currency_code: plan.currency,
                },
              },
            },
          ],
          payment_preferences: {
            auto_bill_outstanding: true,
            setup_fee: {
              value: '0',
              currency_code: plan.currency,
            },
            setup_fee_failure_action: 'CONTINUE',
            payment_failure_threshold: 3,
          },
        },
      },
    );

    const record = this.billingProviderPlansRepo.create({
      provider: 'paypal',
      environment,
      audience,
      planKey,
      externalProductId: product.id,
      externalPriceId: externalPlan.id,
      metadata: {
        label: plan.label,
      },
    });

    return this.billingProviderPlansRepo.save(record);
  }

  private async handleStripeCheckoutCompleted(payload: Record<string, any>) {
    const metadata = payload.metadata ?? {};
    const userId = Number(metadata.userId ?? payload.client_reference_id);
    const audience = this.asAudience(metadata.audience);
    const planKey = this.getPlanKeyForAudience(
      audience ?? 'candidate',
      String(metadata.planKey ?? 'free'),
    );

    if (!userId || !audience) {
      return;
    }

    await this.activateExternalSubscription({
      userId,
      audience,
      planKey,
      provider: 'stripe',
      providerEnvironment: this.getStripeEnvironment(),
      providerCustomerId: this.asNullableString(payload.customer),
      providerSubscriptionId: this.asNullableString(payload.subscription),
      providerMetadata: {
        checkoutSessionId: payload.id ?? null,
      },
      currentPeriodEnd: null,
    });

    await this.upsertInvoice({
      userId,
      audience,
      planKey,
      amount: ((payload.amount_total ?? 0) / 100).toFixed(2),
      currency: String(payload.currency ?? 'usd').toUpperCase(),
      provider: 'stripe',
      providerEnvironment: this.getStripeEnvironment(),
      providerRef: this.asNullableString(payload.payment_intent) ?? String(payload.id),
      status: 'paid',
      metadata: {
        checkoutSessionId: payload.id ?? null,
        stripeSubscriptionId: payload.subscription ?? null,
      },
    });
  }

  private async handleStripeInvoicePaid(payload: Record<string, any>) {
    const subscriptionId = this.asNullableString(payload.subscription);
    if (!subscriptionId) {
      return;
    }

    const subscription = await this.subscriptionsRepo.findOne({
      where: { provider: 'stripe', providerSubscriptionId: subscriptionId },
      relations: ['tenant'],
    });
    if (!subscription?.tenant?.id) {
      return;
    }

    await this.activateExternalSubscription({
      userId: subscription.tenant.id,
      audience: subscription.audience,
      planKey: this.getPlanKeyForAudience(subscription.audience, subscription.planKey),
      provider: 'stripe',
      providerEnvironment: this.getStripeEnvironment(),
      providerCustomerId: this.asNullableString(payload.customer),
      providerSubscriptionId: subscriptionId,
      providerPlanId: this.asNullableString(payload.lines?.data?.[0]?.price?.id),
      providerMetadata: {
        latestInvoiceId: payload.id ?? null,
      },
      currentPeriodEnd: this.toDateFromUnix(payload.lines?.data?.[0]?.period?.end),
    });

    await this.upsertInvoice({
      userId: subscription.tenant.id,
      audience: subscription.audience,
      planKey: this.getPlanKeyForAudience(subscription.audience, subscription.planKey),
      amount: ((payload.amount_paid ?? 0) / 100).toFixed(2),
      currency: String(payload.currency ?? 'usd').toUpperCase(),
      provider: 'stripe',
      providerEnvironment: this.getStripeEnvironment(),
      providerRef: String(payload.id),
      status: 'paid',
      periodStart: this.toDateFromUnix(payload.lines?.data?.[0]?.period?.start),
      periodEnd: this.toDateFromUnix(payload.lines?.data?.[0]?.period?.end),
      metadata: {
        stripeSubscriptionId: subscriptionId,
      },
    });
  }

  private async handleStripeInvoicePaymentFailed(payload: Record<string, any>) {
    const subscriptionId = this.asNullableString(payload.subscription);
    if (!subscriptionId) {
      return;
    }

    const subscription = await this.subscriptionsRepo.findOne({
      where: { provider: 'stripe', providerSubscriptionId: subscriptionId },
      relations: ['tenant'],
    });
    if (!subscription?.tenant?.id) {
      return;
    }

    subscription.status = 'past_due';
    await this.subscriptionsRepo.save(subscription);
    await this.clearEntitlementsCache(subscription.audience, subscription.tenant.id);
  }

  private async handleStripeSubscriptionUpdated(payload: Record<string, any>) {
    const subscriptionId = this.asNullableString(payload.id);
    if (!subscriptionId) {
      return;
    }

    const subscription = await this.subscriptionsRepo.findOne({
      where: { provider: 'stripe', providerSubscriptionId: subscriptionId },
      relations: ['tenant'],
    });
    if (!subscription?.tenant?.id) {
      return;
    }

    subscription.status = this.mapStripeSubscriptionStatus(String(payload.status ?? ''));
    subscription.currentPeriodEnd = this.toDateFromUnix(payload.current_period_end);
    subscription.canceledAt =
      subscription.status === 'canceled' ? new Date() : subscription.canceledAt;
    await this.subscriptionsRepo.save(subscription);
    await this.clearEntitlementsCache(subscription.audience, subscription.tenant.id);
  }

  private async handlePaypalSubscriptionActivated(body: Record<string, unknown>) {
    const resource = (body.resource ?? {}) as Record<string, any>;
    const context = this.parsePaypalCustomId(String(resource.custom_id ?? ''));
    if (!context) {
      return;
    }

    await this.activateExternalSubscription({
      userId: context.userId,
      audience: context.audience,
      planKey: context.planKey,
      provider: 'paypal',
      providerEnvironment: this.getPaypalEnvironment(),
      providerSubscriptionId: this.asNullableString(resource.id),
      providerPlanId: this.asNullableString(resource.plan_id),
      providerMetadata: {
        statusUpdateTime: resource.status_update_time ?? null,
      },
      currentPeriodEnd: this.toDate(resource.billing_info?.next_billing_time),
    });
  }

  private async handlePaypalSubscriptionStatusChanged(
    body: Record<string, unknown>,
    status: SubscriptionStatus,
  ) {
    const resource = (body.resource ?? {}) as Record<string, any>;
    const providerSubscriptionId = this.asNullableString(resource.id);
    if (!providerSubscriptionId) {
      return;
    }

    const subscription = await this.subscriptionsRepo.findOne({
      where: { provider: 'paypal', providerSubscriptionId },
      relations: ['tenant'],
    });
    if (!subscription?.tenant?.id) {
      return;
    }

    subscription.status = status;
    subscription.canceledAt = status === 'canceled' ? new Date() : subscription.canceledAt;
    subscription.currentPeriodEnd = this.toDate(resource.billing_info?.next_billing_time);
    await this.subscriptionsRepo.save(subscription);
    await this.clearEntitlementsCache(subscription.audience, subscription.tenant.id);
  }

  private async handlePaypalPaymentCompleted(body: Record<string, unknown>) {
    const resource = (body.resource ?? {}) as Record<string, any>;
    const providerSubscriptionId =
      this.asNullableString(resource.billing_agreement_id) ??
      this.asNullableString(resource.subscription_id);

    if (!providerSubscriptionId) {
      return;
    }

    const subscription = await this.subscriptionsRepo.findOne({
      where: { provider: 'paypal', providerSubscriptionId },
      relations: ['tenant'],
    });
    if (!subscription?.tenant?.id) {
      return;
    }

    await this.activateExternalSubscription({
      userId: subscription.tenant.id,
      audience: subscription.audience,
      planKey: this.getPlanKeyForAudience(subscription.audience, subscription.planKey),
      provider: 'paypal',
      providerEnvironment: this.getPaypalEnvironment(),
      providerSubscriptionId,
      providerPlanId: this.asNullableString(resource.billing_plan_id),
      providerMetadata: {
        paypalSaleId: resource.id ?? null,
      },
      currentPeriodEnd: null,
    });

    await this.upsertInvoice({
      userId: subscription.tenant.id,
      audience: subscription.audience,
      planKey: this.getPlanKeyForAudience(subscription.audience, subscription.planKey),
      amount: String(resource.amount?.total ?? resource.amount?.value ?? '0.00'),
      currency: String(
        resource.amount?.currency ?? resource.amount?.currency_code ?? 'USD',
      ).toUpperCase(),
      provider: 'paypal',
      providerEnvironment: this.getPaypalEnvironment(),
      providerRef: String(resource.id),
      status: 'paid',
      metadata: {
        paypalSubscriptionId: providerSubscriptionId,
      },
    });
  }

  private async activateExternalSubscription(params: {
    userId: number;
    audience: SubscriptionAudience;
    planKey: PlanKey;
    provider: BillingProvider;
    providerEnvironment: BillingEnvironment;
    providerCustomerId?: string | null;
    providerSubscriptionId?: string | null;
    providerPlanId?: string | null;
    providerMetadata?: Record<string, unknown> | null;
    currentPeriodEnd?: Date | null;
  }) {
    const existing = await this.subscriptionsRepo.findOne({
      where: {
        tenant: { id: params.userId },
        audience: params.audience,
      },
      relations: ['tenant'],
    });

    const now = new Date();
    const subscription = existing ?? this.subscriptionsRepo.create();
    subscription.tenant = { id: params.userId } as User;
    subscription.audience = params.audience;
    subscription.planKey = params.planKey;
    subscription.status = 'active';
    subscription.startedAt = subscription.startedAt ?? now;
    subscription.currentPeriodEnd =
      params.currentPeriodEnd ??
      subscription.currentPeriodEnd ??
      new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    subscription.canceledAt = null;
    subscription.provider = params.provider;
    subscription.providerEnvironment = params.providerEnvironment;
    subscription.providerCustomerId =
      params.providerCustomerId ?? subscription.providerCustomerId;
    subscription.providerSubscriptionId =
      params.providerSubscriptionId ?? subscription.providerSubscriptionId;
    subscription.providerPlanId = params.providerPlanId ?? subscription.providerPlanId;
    subscription.providerMetadata = {
      ...(subscription.providerMetadata ?? {}),
      ...(params.providerMetadata ?? {}),
    };

    await this.subscriptionsRepo.save(subscription);
    await this.clearEntitlementsCache(params.audience, params.userId);
  }

  private async upsertInvoice(params: {
    userId: number;
    audience: SubscriptionAudience;
    planKey: PlanKey;
    amount: string;
    currency: string;
    provider: BillingProvider;
    providerEnvironment: BillingEnvironment;
    providerRef: string;
    status: 'paid' | 'pending' | 'void';
    periodStart?: Date | null;
    periodEnd?: Date | null;
    metadata?: Record<string, unknown>;
  }) {
    const existing = await this.billingInvoicesRepo.findOne({
      where: {
        tenant: { id: params.userId },
        provider: params.provider,
        providerRef: params.providerRef,
      },
      relations: ['tenant'],
    });

    const plan = this.getPlanConfig(params.audience, params.planKey);
    const now = new Date();

    const invoice = existing ?? this.billingInvoicesRepo.create();
    invoice.tenant = { id: params.userId } as User;
    invoice.audience = params.audience;
    invoice.planKey = params.planKey;
    invoice.invoiceNumber =
      existing?.invoiceNumber ?? this.makeInvoiceNumber(params.audience, now);
    invoice.description = `${plan.billing.label} monthly subscription`;
    invoice.amount = this.normalizeAmount(params.amount);
    invoice.currency = params.currency.toUpperCase();
    invoice.status = params.status;
    invoice.periodStart = params.periodStart ?? invoice.periodStart ?? now;
    invoice.periodEnd =
      params.periodEnd ??
      invoice.periodEnd ??
      new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    invoice.provider = params.provider;
    invoice.providerEnvironment = params.providerEnvironment;
    invoice.providerRef = params.providerRef;
    invoice.metadata = {
      ...(invoice.metadata ?? {}),
      ...(params.metadata ?? {}),
    };
    invoice.issuedAt = invoice.issuedAt ?? now;
    invoice.paidAt = params.status === 'paid' ? now : invoice.paidAt;

    await this.billingInvoicesRepo.save(invoice);
  }

  private async verifyPaypalWebhookSignature(
    request: Request,
    body: Record<string, unknown>,
    webhookId: string,
  ) {
    const verification = await this.paypalRequest<PaypalWebhookVerificationResponse>(
      '/v1/notifications/verify-webhook-signature',
      {
        method: 'POST',
        body: {
          auth_algo: request.header('paypal-auth-algo'),
          cert_url: request.header('paypal-cert-url'),
          transmission_id: request.header('paypal-transmission-id'),
          transmission_sig: request.header('paypal-transmission-sig'),
          transmission_time: request.header('paypal-transmission-time'),
          webhook_id: webhookId,
          webhook_event: body,
        },
      },
    );

    return verification.verification_status === 'SUCCESS';
  }

  private verifyStripeSignature(
    rawBody: Buffer,
    signature: string,
    secret: string,
  ) {
    const elements = signature.split(',').reduce<Record<string, string>>((acc, part) => {
      const [key, value] = part.split('=');
      if (key && value) {
        acc[key] = value;
      }
      return acc;
    }, {});

    const timestamp = elements.t;
    const providedSignature = elements.v1;

    if (!timestamp || !providedSignature) {
      throw new BadRequestException('Invalid Stripe signature header');
    }

    const payload = `${timestamp}.${rawBody.toString('utf8')}`;
    const expectedSignature = createHmac('sha256', secret)
      .update(payload)
      .digest('hex');

    const expectedBuffer = Buffer.from(expectedSignature);
    const providedBuffer = Buffer.from(providedSignature);
    if (
      expectedBuffer.length !== providedBuffer.length ||
      !timingSafeEqual(expectedBuffer, providedBuffer)
    ) {
      throw new BadRequestException('Invalid Stripe signature');
    }

    return JSON.parse(rawBody.toString('utf8')) as {
      id: string;
      type: string;
      data?: { object?: Record<string, any> };
    };
  }

  private async stripeRequest<T>(
    path: string,
    options: {
      method: 'GET' | 'POST';
      body?: URLSearchParams;
    },
  ): Promise<T> {
    const secretKey = this.config.get<string>('STRIPE_SECRET_KEY');
    if (!secretKey) {
      throw new ServiceUnavailableException('Stripe is not configured');
    }

    const response = await fetch(`https://api.stripe.com${path}`, {
      method: options.method,
      headers: {
        Authorization: `Bearer ${secretKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: options.body?.toString(),
    });

    if (!response.ok) {
      const text = await response.text();
      this.logger.error(`Stripe request failed: ${text}`);
      throw new ServiceUnavailableException('Stripe request failed');
    }

    return (await response.json()) as T;
  }

  private async paypalRequest<T>(
    path: string,
    options: {
      method: 'GET' | 'POST';
      body?: Record<string, unknown>;
    },
  ): Promise<T> {
    const token = await this.getPaypalAccessToken();
    const response = await fetch(`${this.getPaypalBaseUrl()}${path}`, {
      method: options.method,
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: options.body ? JSON.stringify(options.body) : undefined,
    });

    if (!response.ok) {
      const text = await response.text();
      this.logger.error(`PayPal request failed: ${text}`);
      throw new ServiceUnavailableException('PayPal request failed');
    }

    return (await response.json()) as T;
  }

  private async getPaypalAccessToken() {
    const clientId = this.config.get<string>('PAYPAL_CLIENT_ID');
    const clientSecret = this.config.get<string>('PAYPAL_CLIENT_SECRET');
    if (!clientId || !clientSecret) {
      throw new ServiceUnavailableException('PayPal is not configured');
    }

    const response = await fetch(`${this.getPaypalBaseUrl()}/v1/oauth2/token`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: 'grant_type=client_credentials',
    });

    if (!response.ok) {
      const text = await response.text();
      this.logger.error(`PayPal auth failed: ${text}`);
      throw new ServiceUnavailableException('PayPal authentication failed');
    }

    const payload = (await response.json()) as { access_token: string };
    return payload.access_token;
  }

  private getPaypalBaseUrl() {
    return this.getPaypalEnvironment() === 'live'
      ? 'https://api-m.paypal.com'
      : 'https://api-m.sandbox.paypal.com';
  }

  private getStripeEnvironment(): BillingEnvironment {
    const explicit = this.config.get<string>('STRIPE_ENV');
    if (explicit === 'live') {
      return 'live';
    }
    if (explicit === 'sandbox') {
      return 'sandbox';
    }

    const secretKey = this.config.get<string>('STRIPE_SECRET_KEY') ?? '';
    return secretKey.startsWith('sk_live_') ? 'live' : 'sandbox';
  }

  private getPaypalEnvironment(): BillingEnvironment {
    return this.config.get<string>('PAYPAL_ENV') === 'live' ? 'live' : 'sandbox';
  }

  private getPublicWebUrl() {
    return (
      this.config.get<string>('WEB_URL') ??
      this.config.get<string>('APP_URL') ??
      'http://localhost:3000'
    );
  }

  private resolveSuccessUrl(
    providedUrl: string | undefined,
    provider: BillingProvider,
    planKey: PlanKey,
    fallback: string,
  ) {
    return (
      providedUrl ??
      this.config.get<string>(`${provider.toUpperCase()}_SUCCESS_URL`) ??
      this.config.get<string>('BILLING_SUCCESS_URL') ??
      fallback
    ).replace('{PLAN_KEY}', planKey);
  }

  private resolveCancelUrl(
    providedUrl: string | undefined,
    provider: BillingProvider,
    planKey: PlanKey,
    fallback: string,
  ) {
    return (
      providedUrl ??
      this.config.get<string>(`${provider.toUpperCase()}_CANCEL_URL`) ??
      this.config.get<string>('BILLING_CANCEL_URL') ??
      fallback
    ).replace('{PLAN_KEY}', planKey);
  }

  private getAudienceFromRole(role: UserRole): SubscriptionAudience {
    return role === 'employer' ? 'employer' : 'candidate';
  }

  private getPlanConfig(audience: SubscriptionAudience, planKey: PlanKey) {
    if (audience === 'employer') {
      const config = EMPLOYER_PLANS[planKey as EmployerPlanKey];
      if (!config) {
        throw new BadRequestException('Invalid employer plan');
      }
      return config;
    }

    const config = CANDIDATE_PLANS[planKey as CandidatePlanKey];
    if (!config) {
      throw new BadRequestException('Invalid candidate plan');
    }
    return config;
  }

  private getPlanKeyForAudience(
    audience: SubscriptionAudience,
    planKey: string,
  ): PlanKey {
    return audience === 'employer'
      ? ((EMPLOYER_PLANS[planKey as EmployerPlanKey] ? planKey : 'free') as EmployerPlanKey)
      : ((CANDIDATE_PLANS[planKey as CandidatePlanKey] ? planKey : 'free') as CandidatePlanKey);
  }

  private asAudience(value: unknown): SubscriptionAudience | null {
    return value === 'employer' || value === 'candidate' ? value : null;
  }

  private parsePaypalCustomId(value: string) {
    const [rawUserId, audience, rawPlanKey] = value.split(':');
    const parsedAudience = this.asAudience(audience);
    const userId = Number(rawUserId);

    if (!parsedAudience || !userId) {
      return null;
    }

    return {
      userId,
      audience: parsedAudience,
      planKey: this.getPlanKeyForAudience(parsedAudience, rawPlanKey),
    };
  }

  private mapStripeSubscriptionStatus(value: string): SubscriptionStatus {
    switch (value) {
      case 'trialing':
        return 'trialing';
      case 'past_due':
      case 'unpaid':
        return 'past_due';
      case 'canceled':
      case 'incomplete_expired':
        return 'canceled';
      case 'incomplete':
        return 'inactive';
      default:
        return 'active';
    }
  }

  private priceToMinorUnits(price: number) {
    return Math.round(price * 100);
  }

  private normalizeAmount(amount: string) {
    const numeric = Number(amount);
    return Number.isFinite(numeric) ? numeric.toFixed(2) : '0.00';
  }

  private makeInvoiceNumber(audience: SubscriptionAudience, issuedAt: Date) {
    const stamp = issuedAt.toISOString().replace(/[-:.TZ]/g, '').slice(0, 14);
    const suffix = Math.random().toString(36).slice(2, 8).toUpperCase();
    return `INV-${audience.slice(0, 3).toUpperCase()}-${stamp}-${suffix}`;
  }

  private async clearEntitlementsCache(
    audience: SubscriptionAudience,
    tenantId: number,
  ) {
    await this.cache.del(`${audience}-entitlements:${tenantId}`);
  }

  private asNullableString(value: unknown) {
    return typeof value === 'string' && value.length > 0 ? value : null;
  }

  private toDate(value: unknown) {
    if (typeof value !== 'string') {
      return null;
    }

    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  private toDateFromUnix(value: unknown) {
    if (typeof value !== 'number') {
      return null;
    }

    return new Date(value * 1000);
  }

  private async trackEventForUser(
    userId: number,
    eventName: string,
    payload: Record<string, unknown>,
  ) {
    await this.subscriptionEventsRepo.save(
      this.subscriptionEventsRepo.create({
        tenant: { id: userId } as User,
        eventName,
        payload,
      }),
    );
  }
}
