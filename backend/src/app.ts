import express, { type NextFunction, type Request, type Response } from 'express';
import helmet from 'helmet';
import { config } from './config.js';
import { requestContext } from './middleware/request-context.js';
import { createChatRouter } from './routes/chat.js';
import { createHealthRouter } from './routes/health.js';
import { LlamaCppProvider } from './services/llama-cpp.provider.js';
import type { LlmProvider } from './services/llm-provider.js';

export const createApp = (provider: LlmProvider = new LlamaCppProvider()): express.Express => {
  const app = express();
  app.disable('x-powered-by');
  app.use(helmet({ contentSecurityPolicy: false }));
  app.use(requestContext);
  app.use(express.json({ limit: config.maxRequestBytes }));
  app.use('/api/chat', createChatRouter(provider));
  app.use('/api/health', createHealthRouter(provider));
  app.use((_request, response) => response.status(404).json({ error: 'Not found.' }));
  app.use((error: unknown, _request: Request, response: Response, _next: NextFunction) => {
    if (response.headersSent) return;
    const isBodyTooLarge = error instanceof Error && error.name === 'PayloadTooLargeError';
    response.status(isBodyTooLarge ? 413 : 500).json({
      error: isBodyTooLarge ? 'Request body is too large.' : 'Internal server error.',
      requestId: response.locals['requestId'],
    });
  });
  return app;
};
