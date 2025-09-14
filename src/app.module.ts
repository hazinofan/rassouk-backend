import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';
import { EmployerProfilesModule } from './employer-profile/employer-profile.module';
import { CandidateProfilesModule } from './candidate-profile/candidate-profile.module';
import { PasswordResetModule } from './auth/password-reset.module';
import { UploadModule } from './upload/upload.module';
import { JobsModule } from './jobs/jobs.module';
import { ApplicationsModule } from './applications/applications.module';
import { JobBookmarksModule } from './job-bookmark/job-bookmark.module';
import { JobAlertsModule } from './alerts/alerts.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'mysql',
        host: config.get('DB_HOST'),
        port: config.get<number>('DB_PORT'),
        username: config.get('DB_USER'),
        password: config.get('DB_PASS'),
        database: config.get('DB_NAME'),
        autoLoadEntities: true,
        synchronize: true,
        charset: 'utf8mb4',
        collation: 'utf8mb4_unicode_ci',
      }),
    }),
    UsersModule,
    AuthModule,
    EmployerProfilesModule,
    CandidateProfilesModule,
    PasswordResetModule,
    UploadModule,
    JobsModule,
    ApplicationsModule,
    JobBookmarksModule,
    JobAlertsModule,
  ],
})
export class AppModule {}
