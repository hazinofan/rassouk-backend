import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { join } from 'path';
import { NestExpressApplication } from '@nestjs/platform-express';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // Exemple CORS si front et back sont séparés
  app.enableCors({
    origin: ['http://localhost:3000', 'http://127.0.0.1:3000'],
    credentials: true,
  });

  // Expose /public en statique (URL = /public/…)
  app.useStaticAssets(join(process.cwd(), 'public'), { prefix: '/public' });

  await app.listen(process.env.PORT || 4000);
}
bootstrap();
