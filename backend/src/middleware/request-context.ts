import { randomUUID } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';

export const requestContext = (request: Request, response: Response, next: NextFunction): void => {
  const requestId = request.header('x-request-id')?.slice(0, 128) || randomUUID();
  response.locals['requestId'] = requestId;
  response.setHeader('x-request-id', requestId);
  next();
};
