import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { MailService } from 'src/mail/mail.service';
import { User } from 'src/users/users.entity';
import { Repository } from 'typeorm';
import { SendSupportMessageDto } from './dto/send-support-message.dto';
import { SupportMessage } from './entities/support-message.entity';

@Injectable()
export class SupportService {
  constructor(
    @InjectRepository(User)
    private readonly usersRepo: Repository<User>,
    @InjectRepository(SupportMessage)
    private readonly supportMessagesRepo: Repository<SupportMessage>,
    private readonly mail: MailService,
  ) {}

  async sendMessage(userId: number, dto: SendSupportMessageDto) {
    const user = await this.usersRepo.findOne({
      where: { id: userId },
      select: ['id', 'name', 'email', 'role'],
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const saved = await this.supportMessagesRepo.save(
      this.supportMessagesRepo.create({
        userId: user.id,
        email: dto.email.trim().toLowerCase(),
        title: dto.title.trim(),
        message: dto.message.trim(),
      }),
    );

    await this.mail.sendSupportMessage({
      userId: user.id,
      userRole: user.role,
      userName: user.name,
      userEmail: dto.email,
      accountEmail: user.email,
      title: dto.title,
      message: dto.message,
    });

    return { ok: true, id: saved.id };
  }
}
