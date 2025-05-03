import { NestFactory } from '@nestjs/core';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';
import { BadRequestException, ValidationPipe } from '@nestjs/common';
import * as cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { HttpExceptionFilter } from './common/exceptions/http-exception.filter';

async function bootstrap() {
  try {
    const app = await NestFactory.create(AppModule);

    // Get the filter from the app container to enable DI
    const httpExceptionFilter = app.get(HttpExceptionFilter);
    app.useGlobalFilters(httpExceptionFilter);

    // Apply Helmet middleware for security headers
    app.use(
      helmet({
        contentSecurityPolicy: {
          directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", "'unsafe-inline'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            imgSrc: ["'self'", 'data:'],
            connectSrc: ["'self'", 'https://accounts.google.com'],
            frameSrc: ["'self'", 'https://accounts.google.com'],
            objectSrc: ["'none'"],
            upgradeInsecureRequests: [],
          },
        },
      }),
    );

    app.useGlobalPipes(
      new ValidationPipe({
        transform: true,
        transformOptions: { enableImplicitConversion: true },
        whitelist: true,
        forbidNonWhitelisted: true,
        exceptionFactory: (errors) => {
          const formattedErrors = errors.reduce((acc, error) => {
            const property = error.property;
            const messages = Object.values(error.constraints || {});

            if (!acc[property]) {
              acc[property] = [];
            }

            acc[property].push(...messages);
            return acc;
          }, {});

          throw new BadRequestException({
            message: 'Validation failed',
            errors: formattedErrors,
          });
        },
      }),
    );

    app.use(cookieParser());

    const configService = app.get(ConfigService);
    const port = configService.get('PORT') ?? 3001;

    // Setup CORS if needed
    const allowedOrigins =
      configService.get('ALLOWED_ORIGINS')?.split(',') ??
      'http://localhost:3000';
    app.enableCors({
      origin: allowedOrigins,
      credentials: true, // This is the missing piece
    });

    // Setup Swagger
    const config = new DocumentBuilder()
      .setTitle('Scaffold')
      .setDescription(
        'Open-source, TypeScript-based foundation for production applications.',
      )
      .setVersion('0.0.1')
      .addBearerAuth(
        {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          in: 'header',
        },
        'JWT',
      )
      .build();
    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api', app, document);

    await app.listen(port, '0.0.0.0');
    console.log(`✅ Application is running on port ${port}`);
    console.log(`✅ Swagger documentation available at /api`);
  } catch (error) {
    console.error('❌ Failed to start application:', error);
    process.exit(1);
  }
}

bootstrap().catch((error) => {
  console.error('❌ Unhandled bootstrap error:', error);
  process.exit(1);
});
