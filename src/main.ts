import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser';
import { join } from 'path';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';

function parseCorsOrigins(value?: string | null) {
  return (value ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
}

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    rawBody: true,
  });
  const config = app.get(ConfigService);
  const webUrl = config.get<string>('WEB_URL');
  const nodeEnv = config.get<string>('NODE_ENV') ?? 'development';
  const configuredOrigins = parseCorsOrigins(config.get<string>('CORS_ORIGINS'));
  const localOrigins =
    nodeEnv === 'production'
      ? []
      : ['http://localhost:3000', 'http://127.0.0.1:3000'];
  const allowedOrigins = Array.from(
    new Set([...localOrigins, ...(webUrl ? [webUrl] : []), ...configuredOrigins]),
  );

  app.enableCors({
    origin: allowedOrigins,
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  app.use(cookieParser());
  app.useStaticAssets(join(process.cwd(), 'public'), { prefix: '/public' });

  await app.listen(process.env.PORT || 4000);
}

void bootstrap();
