import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { BillingInvoice } from 'src/subscriptions/billing-invoice.entity';
import { Subscription } from 'src/subscriptions/subscription.entity';
import { Repository } from 'typeorm';
import { AdminInvoiceQueryDto } from './dto/admin-invoice-query.dto';
import { AdminSubscriptionQueryDto } from './dto/admin-subscription-query.dto';

@Injectable()
export class AdminBillingService {
  constructor(
    @InjectRepository(Subscription)
    private readonly subscriptionsRepo: Repository<Subscription>,
    @InjectRepository(BillingInvoice)
    private readonly invoicesRepo: Repository<BillingInvoice>,
  ) {}

  async listSubscriptions(query: AdminSubscriptionQueryDto) {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(query.limit) || 20));
    const skip = (page - 1) * limit;

    const qb = this.subscriptionsRepo
      .createQueryBuilder('s')
      .leftJoinAndSelect('s.tenant', 'tenant');

    if (query.q?.trim()) {
      const term = `%${query.q.trim()}%`;
      qb.andWhere('(tenant.email LIKE :term OR tenant.name LIKE :term)', { term });
    }
    if (query.audience) qb.andWhere('s.audience = :audience', { audience: query.audience });
    if (query.status) qb.andWhere('s.status = :status', { status: query.status });

    qb.orderBy(`s.${query.sortBy ?? 'updatedAt'}`, query.sortDir ?? 'DESC');
    qb.skip(skip).take(limit);

    const [data, total] = await qb.getManyAndCount();
    return { data, total, page, limit };
  }

  async getSubscription(id: number) {
    const item = await this.subscriptionsRepo.findOne({
      where: { id },
      relations: ['tenant'],
    });
    if (!item) throw new NotFoundException('Subscription not found');
    return item;
  }

  async listInvoices(query: AdminInvoiceQueryDto) {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(query.limit) || 20));
    const skip = (page - 1) * limit;

    const qb = this.invoicesRepo
      .createQueryBuilder('i')
      .leftJoinAndSelect('i.tenant', 'tenant');

    if (query.q?.trim()) {
      const term = `%${query.q.trim()}%`;
      qb.andWhere(
        '(tenant.email LIKE :term OR tenant.name LIKE :term OR i.invoiceNumber LIKE :term)',
        { term },
      );
    }
    if (query.audience) qb.andWhere('i.audience = :audience', { audience: query.audience });
    if (query.status) qb.andWhere('i.status = :status', { status: query.status });

    qb.orderBy(`i.${query.sortBy ?? 'issuedAt'}`, query.sortDir ?? 'DESC');
    qb.skip(skip).take(limit);

    const [data, total] = await qb.getManyAndCount();
    return { data, total, page, limit };
  }

  async getInvoice(id: number) {
    const item = await this.invoicesRepo.findOne({
      where: { id },
      relations: ['tenant'],
    });
    if (!item) throw new NotFoundException('Invoice not found');
    return item;
  }
}
