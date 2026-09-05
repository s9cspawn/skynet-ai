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

describe('Skynet API', () => {
  const app = createApp(new FakeProvider());

  const signedInAgent = async () => {
    const agent = request.agent(app);
    await agent.post('/api/auth/register').send({ name: 'Test User', email: `test-${crypto.randomUUID()}@example.com`, password: 'correct-horse-battery' }).expect(201);
    return agent;
  };

  it('rejects unsupported chat roles', async () => {
    const agent = await signedInAgent();
    const response = await agent.post('/api/chat').send({ messages: [{ role: 'tool', content: 'no' }] });
    expect(response.status).toBe(400);
    expect(response.body.error).toBe('Invalid chat request.');
  });

  it('streams upstream SSE without buffering', async () => {
    const agent = await signedInAgent();
    const response = await agent.post('/api/chat').send({ messages: [{ role: 'user', content: 'hello' }] });
    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toContain('text/event-stream');
    expect(response.text).toContain('"content":"Local"');
    expect(response.text).toContain('data: [DONE]');
  });

  it('protects user conversations behind authentication', async () => {
    await request(app).get('/api/conversations').expect(401);
    const agent = await signedInAgent();
    await agent.get('/api/conversations').expect(200);
  });

  it('keeps conversations after signing out and back in', async () => {
    const email = `persist-${crypto.randomUUID()}@example.com`;
    const password = 'correct-horse-battery';
    const agent = request.agent(app);
    await agent.post('/api/auth/register').send({ name: 'Persistent User', email, password }).expect(201);

    const now = new Date().toISOString();
    const saved = {
      id: crypto.randomUUID(),
      title: 'Saved locally',
      messages: [{ id: crypto.randomUUID(), role: 'user', content: 'Remember this', createdAt: now }],
      createdAt: now,
      updatedAt: now,
    };
    await agent.put(`/api/conversations/${saved.id}`).send(saved).expect(204);
    await agent.post('/api/auth/logout').expect(204);
    await agent.get('/api/conversations').expect(401);

    await agent.post('/api/auth/login').send({ email, password }).expect(200);
    const response = await agent.get('/api/conversations').expect(200);
    expect(response.body.conversations).toContainEqual(saved);
  });

  it('reports provider health', async () => {
    const response = await request(app).get('/api/health');
    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ api: 'ok', llama: 'ok', model: 'Skynet-12B' });
  });
});
