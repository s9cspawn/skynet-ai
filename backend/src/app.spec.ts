import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from './app.js';
import type { LlmProvider } from './services/llm-provider.js';
import type { ChatRequest, ProviderHealth } from './types.js';

class FakeProvider implements LlmProvider {
  async streamChat(_request: ChatRequest, _signal: AbortSignal): Promise<Response> {
    const events = ['data: {"choices":[{"delta":{"content":"Local"}}]}\n\n', 'data: [DONE]\n\n'];
    return new Response(events.join(''), { status: 200, headers: { 'content-type': 'text/event-stream' } });
  }

  async healthCheck(): Promise<ProviderHealth> {
    return { available: true, model: 'test-model' };
  }
}

describe('local AI API', () => {
  const app = createApp(new FakeProvider());

  it('rejects unsupported chat roles', async () => {
    const response = await request(app).post('/api/chat').send({ messages: [{ role: 'tool', content: 'no' }] });
    expect(response.status).toBe(400);
    expect(response.body.error).toBe('Invalid chat request.');
  });

  it('streams upstream SSE without buffering', async () => {
    const response = await request(app).post('/api/chat').send({ messages: [{ role: 'user', content: 'hello' }] });
    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toContain('text/event-stream');
    expect(response.text).toContain('"content":"Local"');
    expect(response.text).toContain('data: [DONE]');
  });

  it('reports provider health', async () => {
    const response = await request(app).get('/api/health');
    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ api: 'ok', llama: 'ok', model: 'test-model' });
  });
});
