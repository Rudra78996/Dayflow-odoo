import { Injectable, NestMiddleware } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';

export type RequestWithId = Request & { requestId?: string };

@Injectable()
export class RequestContextMiddleware implements NestMiddleware {
  use(request: RequestWithId, response: Response, next: NextFunction) {
    const supplied = request.header('x-request-id');
    request.requestId =
      supplied && /^[a-zA-Z0-9._:-]{1,100}$/.test(supplied)
        ? supplied
        : randomUUID();
    response.setHeader('x-request-id', request.requestId);
    next();
  }
}
