import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { EmailToken } from './email-token.entity';
import { UsersModule } from '../users/users.module';
import { MailModule } from 'src/mail/mail.module';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [
    TypeOrmModule.forFeature([EmailToken]),
    UsersModule,
    MailModule,
    ConfigModule,
    JwtModule.register({}),
  ],
  providers: [AuthService],
  controllers: [AuthController],
})
export class AuthModule {}
