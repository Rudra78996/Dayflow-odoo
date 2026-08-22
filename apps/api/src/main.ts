import { ConsoleLogger, ValidationPipe } from '@nestjs/common';
import type { CustomOrigin } from '@nestjs/common/interfaces/external/cors-options.interface';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import type { NextFunction, Request, Response } from 'express';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/http-exception.filter';
import { isAllowedOrigin } from './common/origin-policy';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  const config = app.get(ConfigService);
  app.useLogger(new ConsoleLogger({ json: true, timestamp: true }));

  const configuredOrigins = config.get<string>(
    'WEB_ORIGIN',
    'http://localhost:3000',
  );
  const environment = config.get<string>('NODE_ENV', 'development');
  const corsOrigin: CustomOrigin = (origin, callback) => {
    if (!origin || isAllowedOrigin(origin, configuredOrigins, environment)) {
      callback(null, true);
      return;
    }
    callback(new Error('CORS origin denied'), false);
  };

  app.setGlobalPrefix('v1');
  app.use(helmet());
  app.use(cookieParser());
  app.use((request: Request, response: Response, next: NextFunction) => {
    const origin = request.header('origin');
    const mutation = !['GET', 'HEAD', 'OPTIONS'].includes(request.method);
    if (
      mutation &&
      origin &&
      !isAllowedOrigin(origin, configuredOrigins, environment)
    ) {
      response.status(403).json({
        statusCode: 403,
        code: 'CSRF_ORIGIN_DENIED',
        message: 'The request origin is not allowed.',
      });
      return;
    }
    next();
  });
  app.enableCors({
    origin: corsOrigin,
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
  });
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
      stopAtFirstError: false,
    }),
  );
  app.useGlobalFilters(new HttpExceptionFilter());
  app.enableShutdownHooks();

  const swaggerConfig = new DocumentBuilder()
    .setTitle('Dayflow API')
    .setDescription('Dayflow HRMS REST API')
    .setVersion('1.0')
    .addCookieAuth('dayflow_access')
    .build();
  SwaggerModule.setup(
    'v1/docs',
    app,
    SwaggerModule.createDocument(app, swaggerConfig),
  );

  await app.listen(config.get<number>('API_PORT', 3001));
}
void bootstrap();
