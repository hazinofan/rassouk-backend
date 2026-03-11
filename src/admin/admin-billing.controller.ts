import {
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Roles } from 'src/auth/decorators/roles.decorator';
import { RolesGuard } from 'src/auth/decorators/roles.guard';
import { JwtAuthGuard } from 'src/auth/guards/jwt.guard';
import { AdminBillingService } from './admin-billing.service';
import { AdminInvoiceQueryDto } from './dto/admin-invoice-query.dto';
import { AdminSubscriptionQueryDto } from './dto/admin-subscription-query.dto';

@Controller('admin/billing')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
export class AdminBillingController {
  constructor(private readonly billing: AdminBillingService) {}

  @Get('subscriptions')
  listSubscriptions(@Query() query: AdminSubscriptionQueryDto) {
    return this.billing.listSubscriptions(query);
  }

  @Get('subscriptions/:id')
  getSubscription(@Param('id', ParseIntPipe) id: number) {
    return this.billing.getSubscription(id);
  }

  @Get('invoices')
  listInvoices(@Query() query: AdminInvoiceQueryDto) {
    return this.billing.listInvoices(query);
  }

  @Get('invoices/:id')
  getInvoice(@Param('id', ParseIntPipe) id: number) {
    return this.billing.getInvoice(id);
  }
}
