import { once } from 'node:events';
import { Router } from 'express';
import { z } from 'zod';
import { logRequest } from '../logger.js';
import type { LlmProvider } from '../services/llm-provider.js';

const messageSchema = z.object({
  role: z.enum(['system', 'user', 'assistant']),
  content: z.string().trim().min(1).max(100_000),
});

const chatSchema = z.object({
  messages: z.array(messageSchema).min(1).max(200),
  temperature: z.number().min(0).max(2).default(0.7),
  topP: z.number().min(0).max(1).default(0.95),
  maxTokens: z.number().int().min(1).max(131_072).default(2048),
});

const upstreamMessage = (status: number, text: string): string => {
  const lowered = text.toLowerCase();
  if (lowered.includes('context') && (lowered.includes('length') || lowered.includes('window'))) {
    return 'This conversation is too long for the model context. Start a new chat or shorten the conversation.';
  }
  if (status === 503 || lowered.includes('loading')) {
    return 'The local model is still loading. Please try again shortly.';
  }
  return `The local model returned an error (${status}).`;
};

export const createChatRouter = (provider: LlmProvider): Router => {
  const router = Router();

  router.post('/', async (request, response) => {
    const startedAt = performance.now();
    const requestId = String(response.locals['requestId']);
    const parsed = chatSchema.safeParse(request.body);
    if (!parsed.success) {
      logRequest({ requestId, endpoint: '/api/chat', status: 400, durationMs: Math.round(performance.now() - startedAt), error: 'invalid request' });
      response.status(400).json({ error: 'Invalid chat request.', requestId });
      return;
    }

    const upstreamAbort = new AbortController();
    let completed = false;
    const abortUpstream = (): void => {
      if (!completed) upstreamAbort.abort();
    };
    request.once('aborted', abortUpstream);
    response.once('close', abortUpstream);

    let status = 200;
    let error: string | undefined;
    try {
      const upstream = await provider.streamChat(parsed.data, upstreamAbort.signal);
      if (!upstream.ok || !upstream.body) {
        const detail = (await upstream.text()).slice(0, 2_000);
        status = upstream.status || 502;
        error = upstreamMessage(status, detail);
        response.status(status).json({ error, requestId });
        return;
      }

      response.status(200);
      response.setHeader('content-type', 'text/event-stream; charset=utf-8');
      response.setHeader('cache-control', 'no-cache, no-transform');
      response.setHeader('connection', 'keep-alive');
      response.setHeader('x-accel-buffering', 'no');
      response.flushHeaders();

      const reader = upstream.body.getReader();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (!response.write(value)) await once(response, 'drain');
      }
      completed = true;
      response.end();
    } catch (caught) {
      const wasCancelled = upstreamAbort.signal.aborted || request.destroyed;
      status = wasCancelled ? 499 : 502;
      error = caught instanceof Error ? caught.message : 'unknown upstream failure';
      if (!response.headersSent) {
        response.status(wasCancelled ? 499 : 502).json({
          error: wasCancelled
            ? 'Generation cancelled.'
            : 'Unable to contact Skynet. Check that llama-server is running on 127.0.0.1:8080.',
          requestId,
        });
      } else if (!response.writableEnded) {
        response.write(`event: error\ndata: ${JSON.stringify({ error: 'The model stream was interrupted.', requestId })}\n\n`);
        response.end();
      }
    } finally {
      completed = true;
      request.off('aborted', abortUpstream);
      response.off('close', abortUpstream);
      logRequest({
        requestId,
        endpoint: '/api/chat',
        messages: parsed.data.messages.length,
        durationMs: Math.round(performance.now() - startedAt),
        status,
        ...(error ? { error } : {}),
      });
    }
  });

  return router;
};
