import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AdminAuditLog } from './entities/admin-audit-log.entity';

@Injectable()
export class AdminAuditService {
  constructor(
    @InjectRepository(AdminAuditLog)
    private readonly repo: Repository<AdminAuditLog>,
  ) {}

  async log(params: {
    actorUserId: number;
    action: string;
    entityType: string;
    entityId: string | number;
    payload?: Record<string, unknown> | null;
    ip?: string | null;
    userAgent?: string | null;
  }) {
    await this.repo.save(
      this.repo.create({
        actorUserId: params.actorUserId,
        action: params.action,
        entityType: params.entityType,
        entityId: String(params.entityId),
        payload: params.payload ?? null,
        ip: params.ip ?? null,
        userAgent: params.userAgent ?? null,
      }),
    );
  }
}
