import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // CORS - Allow admin frontend, widget, demo apps
  const allowedOrigins = [
    process.env.FRONTEND_URL || 'http://localhost:3000',
    process.env.WIDGET_URL || 'http://localhost:5173',
    'http://localhost:4173', // widget preview
    'http://localhost:5174', // deneme demo app
  ];

  app.enableCors({
    origin: (origin, callback) => {
      // Allow requests with no origin (mobile apps, curl, postman)
      if (!origin) return callback(null, true);

      // Check if it's an admin/widget origin
      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      // For public widget endpoints (/api/public/*), allow all origins
      // Domain validation is handled at the application layer via allowedDomains
      // This enables widgets to be embedded on customer websites
      // Note: Origin is available in request headers for application-level validation
      callback(null, true);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  });

  // Global prefix
  app.setGlobalPrefix('api');

  await app.listen(process.env.PORT ?? 8080);
  console.log(
    `🚀 Application is running on: http://localhost:${process.env.PORT ?? 8080}/api`,
  );
}
bootstrap();
