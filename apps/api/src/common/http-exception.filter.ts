import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import type { Response } from 'express';
import type { RequestWithId } from './request-context.middleware';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const context = host.switchToHttp();
    const request = context.getRequest<RequestWithId>();
    const response = context.getResponse<Response>();
    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;
    const value =
      exception instanceof HttpException ? exception.getResponse() : undefined;
    const details = typeof value === 'object' && value ? value : {};
    const messageValue =
      typeof value === 'string'
        ? value
        : 'message' in details
          ? details.message
          : undefined;
    response.status(status).json({
      statusCode: status,
      code:
        'code' in details && typeof details.code === 'string'
          ? details.code
          : status === 500
            ? 'INTERNAL_SERVER_ERROR'
            : 'REQUEST_FAILED',
      message:
        messageValue ??
        (status === 500
          ? 'An unexpected error occurred.'
          : 'The request could not be completed.'),
      requestId: request.requestId,
      path: request.originalUrl,
      timestamp: new Date().toISOString(),
    });
  }
}
