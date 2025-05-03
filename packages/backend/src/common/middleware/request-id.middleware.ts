import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { createId } from '@paralleldrive/cuid2';

@Injectable()
export class RequestIdMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    // Use existing or generate new request ID
    const requestId = req.headers['x-request-id'] ?? createId();

    // Set it on both request and response
    req.headers['x-request-id'] = requestId;
    res.setHeader('X-Request-ID', requestId);

    next();
  }
}
