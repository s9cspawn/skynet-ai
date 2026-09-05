import { Router } from 'express';
import { config } from '../config.js';
import { logRequest } from '../logger.js';
import type { LlmProvider } from '../services/llm-provider.js';

export const createHealthRouter = (provider: LlmProvider): Router => {
  const router = Router();

  router.get('/', async (_request, response) => {
    const startedAt = performance.now();
    const requestId = String(response.locals['requestId']);
    let status = 200;

    try {
      const health = await provider.healthCheck();
      response.json({
        api: 'ok',
        llama: health.available ? 'ok' : 'unavailable',
        model: health.model,
        localInference: config.isLocalInference,
      });
    } catch {
      status = 503;
      response.status(status).json({
        api: 'ok',
        llama: 'unavailable',
        model: config.llamaModel,
        localInference: config.isLocalInference,
      });
    } finally {
      logRequest({ requestId, endpoint: '/api/health', status, durationMs: Math.round(performance.now() - startedAt) });
    }
  });

  return router;
};
