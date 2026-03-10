import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { User } from './users.entity';
import { SavedCandidate } from 'src/saved_candidate/entities/saved_candidate.entity';
import { EmployerProfile } from 'src/employer-profile/entities/employer-profile.entity';

@Module({
  imports: [TypeOrmModule.forFeature([User, SavedCandidate, EmployerProfile])],
  providers: [UsersService],
  controllers: [UsersController],
  exports: [UsersService],
})
export class UsersModule {}
