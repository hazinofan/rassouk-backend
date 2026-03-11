import {
  Body,
  Controller,
  Get,
  Header,
  Param,
  ParseIntPipe,
  Post,
  Res,
  StreamableFile,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from 'src/auth/decorators/current-user.decoratoe';
import { RolesGuard } from 'src/auth/decorators/roles.guard';
import { JwtAuthGuard } from 'src/auth/guards/jwt.guard';
import { ChoosePlanDto } from './dto/choose-plan.dto';
import { EntitlementsService } from './entitlements.service';
import type { Response } from 'express';

@Controller('billing')
@UseGuards(JwtAuthGuard, RolesGuard)
export class SubscriptionsController {
  constructor(private readonly entitlements: EntitlementsService) {}

  @Get('subscription')
  getSubscription(@CurrentUser() user: any) {
    return this.entitlements.getBillingSnapshot(user.id);
  }

  @Get('history')
  getHistory(@CurrentUser() user: any) {
    return this.entitlements.getBillingHistory(user.id, user.role);
  }

  @Get('history/:invoiceId/receipt.pdf')
  @Header('Content-Type', 'application/pdf')
  async getReceiptPdf(
    @CurrentUser() user: any,
    @Param('invoiceId', ParseIntPipe) invoiceId: number,
    @Res({ passthrough: true }) res: Response,
  ) {
    const receipt = await this.entitlements.getBillingReceiptPdf(
      user.id,
      user.role,
      invoiceId,
    );
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${receipt.filename}"`,
    );
    return new StreamableFile(receipt.buffer);
  }

  @Post('choose-plan')
  choosePlan(@CurrentUser() user: any, @Body() dto: ChoosePlanDto) {
    return this.entitlements
      .choosePlanForUser(user.id, user.role, dto.planKey)
      .then(() => this.entitlements.getBillingSnapshot(user.id));
  }

  @Post('cancel')
  cancel(@CurrentUser() user: any) {
    return this.entitlements
      .cancelPlanForUser(user.id, user.role)
      .then(() => this.entitlements.getBillingSnapshot(user.id));
  }

}
