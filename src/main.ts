import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // ValidationPipe sprawdza DTO (np. czy email jest poprawny).
  // whitelist: true — ignoruje pola których nie ma w DTO (bezpieczeństwo).
  app.useGlobalPipes(new ValidationPipe({ whitelist: true }));

  // Serwowanie plików statycznych (frontend) z folderu public
  app.useStaticAssets(join(__dirname, '..', 'src', 'public'));

  const port = process.env.PORT || 3000;
  await app.listen(port);
  console.log(`Server running on http://localhost:${port}`);
}
bootstrap();
