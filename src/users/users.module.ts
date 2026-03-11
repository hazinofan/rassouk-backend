import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { User } from './users.entity';
import { SavedCandidate } from 'src/saved_candidate/entities/saved_candidate.entity';
import { JwtModule } from '@nestjs/jwt';
import { JwtAuthGuard } from 'src/auth/guards/jwt.guard';
import { RolesGuard } from 'src/auth/decorators/roles.guard';
import { EmployerProfile } from 'src/employer-profile/entities/employer-profile.entity';

@Module({
  imports: [TypeOrmModule.forFeature([User, SavedCandidate, EmployerProfile]), JwtModule.register({})],
  providers: [UsersService, JwtAuthGuard, RolesGuard],
  controllers: [UsersController],
  exports: [UsersService],
})
export class UsersModule {}
