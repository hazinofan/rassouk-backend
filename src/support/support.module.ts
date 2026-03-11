import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { JwtAuthGuard } from 'src/auth/guards/jwt.guard';
import { MailModule } from 'src/mail/mail.module';
import { User } from 'src/users/users.entity';
import { SupportController } from './support.controller';
import { SupportService } from './support.service';
import { SupportMessage } from './entities/support-message.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, SupportMessage]),
    JwtModule.register({}),
    MailModule,
  ],
  controllers: [SupportController],
  providers: [SupportService, JwtAuthGuard],
})
export class SupportModule {}
