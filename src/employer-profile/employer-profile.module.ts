import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EmployerProfilesService } from './employer-profile.service';
import { EmployerProfilesController } from './employer-profile.controller';
import { EmployerProfile } from './entities/employer-profile.entity';
import { AuthModule } from 'src/auth/auth.module';
import { RolesGuard } from 'src/auth/decorators/roles.guard';
import { User } from 'src/users/users.entity';

@Module({
  imports: [TypeOrmModule.forFeature([EmployerProfile, User]), AuthModule],
  providers: [EmployerProfilesService, RolesGuard],
  controllers: [EmployerProfilesController],
  exports: [EmployerProfilesService],
})
export class EmployerProfilesModule {}
