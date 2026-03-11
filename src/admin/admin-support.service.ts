import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { SupportMessage } from 'src/support/entities/support-message.entity';
import { User } from 'src/users/users.entity';
import { Repository } from 'typeorm';
import { AdminSupportAssignDto } from './dto/admin-support-assign.dto';
import { AdminSupportQueryDto } from './dto/admin-support-query.dto';
import { AdminSupportStatusDto } from './dto/admin-support-status.dto';

@Injectable()
export class AdminSupportService {
  constructor(
    @InjectRepository(SupportMessage)
    private readonly messagesRepo: Repository<SupportMessage>,
    @InjectRepository(User)
    private readonly usersRepo: Repository<User>,
  ) {}

  async list(query: AdminSupportQueryDto) {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(query.limit) || 20));
    const skip = (page - 1) * limit;

    const qb = this.messagesRepo
      .createQueryBuilder('m')
      .leftJoinAndSelect('m.user', 'user')
      .leftJoinAndSelect('m.assignedTo', 'assignedTo');

    if (query.q?.trim()) {
      const term = `%${query.q.trim()}%`;
      qb.andWhere(
        '(m.title LIKE :term OR m.message LIKE :term OR m.email LIKE :term OR user.email LIKE :term)',
        { term },
      );
    }
    if (query.status) qb.andWhere('m.status = :status', { status: query.status });
    if (query.priority) {
      qb.andWhere('m.priority = :priority', { priority: query.priority });
    }

    qb.orderBy(`m.${query.sortBy ?? 'createdAt'}`, query.sortDir ?? 'DESC');
    qb.skip(skip).take(limit);

    const [data, total] = await qb.getManyAndCount();
    return { data, total, page, limit };
  }

  async getOne(id: number) {
    const message = await this.messagesRepo.findOne({
      where: { id },
      relations: ['user', 'assignedTo'],
    });
    if (!message) throw new NotFoundException('Support message not found');
    return message;
  }

  async setStatus(id: number, dto: AdminSupportStatusDto, adminUserId: number) {
    const message = await this.messagesRepo.findOne({ where: { id } });
    if (!message) throw new NotFoundException('Support message not found');

    message.status = dto.status;
    if (dto.status === 'resolved' || dto.status === 'closed') {
      message.resolvedAt = new Date();
      message.resolvedByUserId = adminUserId;
    } else {
      message.resolvedAt = null;
      message.resolvedByUserId = null;
    }
    return this.messagesRepo.save(message);
  }

  async assign(id: number, dto: AdminSupportAssignDto) {
    const [message, assignee] = await Promise.all([
      this.messagesRepo.findOne({ where: { id } }),
      this.usersRepo.findOne({ where: { id: dto.adminUserId } }),
    ]);
    if (!message) throw new NotFoundException('Support message not found');
    if (!assignee || assignee.role !== 'admin') {
      throw new NotFoundException('Admin assignee not found');
    }

    message.assignedToUserId = assignee.id;
    if (message.status === 'open') {
      message.status = 'in_progress';
    }
    return this.messagesRepo.save(message);
  }
}
