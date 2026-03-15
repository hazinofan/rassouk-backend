import { Body, Controller, HttpCode, Post, RawBody, Req } from '@nestjs/common';
import type { RawBodyRequest } from '@nestjs/common';
import type { Request } from 'express';
import { BillingCheckoutService } from './billing-checkout.service';

@Controller('billing/webhooks')
export class BillingWebhooksController {
  constructor(private readonly billingCheckout: BillingCheckoutService) {}

  @Post('stripe')
  @HttpCode(200)
  handleStripeWebhook(
    @Req() request: RawBodyRequest<Request>,
    @RawBody() rawBody?: Buffer,
  ) {
    return this.billingCheckout.handleStripeWebhook(request, rawBody);
  }

  @Post('paypal')
  @HttpCode(200)
  handlePaypalWebhook(
    @Req() request: Request,
    @Body() body: Record<string, unknown>,
  ) {
    return this.billingCheckout.handlePaypalWebhook(request, body);
  }
}
