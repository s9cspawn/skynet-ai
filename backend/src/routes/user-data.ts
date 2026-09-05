import { Router } from 'express';
import { z } from 'zod';
import { database } from '../database/database.js';
import { requireAuth } from '../middleware/auth.js';
import type { AuthUser } from '../services/auth.service.js';

const message = z.object({ id: z.string().min(1).max(100), role: z.enum(['system','user','assistant']), content: z.string().max(200_000), createdAt: z.string().datetime(), error: z.boolean().optional() });
const conversation = z.object({ id: z.string().min(1).max(100), title: z.string().min(1).max(200), messages: z.array(message).max(500), createdAt: z.string().datetime(), updatedAt: z.string().datetime() });
const settings = z.object({ systemPrompt: z.string().min(1).max(100_000), temperature: z.number().min(0).max(2), topP: z.number().min(0).max(1), maxTokens: z.number().int().min(1).max(131_072) });
const userId = (locals: Record<string, unknown>): string => (locals['user'] as AuthUser).id;

export const createUserDataRouter = (): Router => {
  const router = Router();
  router.use(requireAuth);
  router.get('/conversations', (_request, response) => {
    const rows = database.prepare('SELECT id, title, messages_json, created_at, updated_at FROM conversations WHERE user_id = ? ORDER BY updated_at DESC').all(userId(response.locals)) as Array<Record<string,string>>;
    response.json({ conversations: rows.map(row => ({ id: row['id'], title: row['title'], messages: JSON.parse(row['messages_json'] ?? '[]'), createdAt: row['created_at'], updatedAt: row['updated_at'] })) });
  });
  router.put('/conversations/:id', (request, response) => {
    const parsed = conversation.safeParse(request.body);
    if (!parsed.success || parsed.data.id !== request.params['id']) { response.status(400).json({ error: 'Invalid conversation.' }); return; }
    const item = parsed.data;
    database.prepare(`INSERT INTO conversations (id,user_id,title,messages_json,created_at,updated_at) VALUES (?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET title=excluded.title,messages_json=excluded.messages_json,updated_at=excluded.updated_at WHERE user_id=excluded.user_id`)
      .run(item.id, userId(response.locals), item.title, JSON.stringify(item.messages), item.createdAt, item.updatedAt);
    response.status(204).end();
  });
  router.delete('/conversations/:id', (request, response) => { database.prepare('DELETE FROM conversations WHERE id = ? AND user_id = ?').run(request.params['id'], userId(response.locals)); response.status(204).end(); });
  router.get('/settings', (_request, response) => {
    const row = database.prepare('SELECT settings_json FROM user_settings WHERE user_id = ?').get(userId(response.locals)) as { settings_json: string } | undefined;
    response.json({ settings: row ? JSON.parse(row.settings_json) : null });
  });
  router.put('/settings', (request, response) => {
    const parsed = settings.safeParse(request.body);
    if (!parsed.success) { response.status(400).json({ error: 'Invalid settings.' }); return; }
    database.prepare(`INSERT INTO user_settings (user_id,settings_json,updated_at) VALUES (?,?,?) ON CONFLICT(user_id) DO UPDATE SET settings_json=excluded.settings_json,updated_at=excluded.updated_at`)
      .run(userId(response.locals), JSON.stringify(parsed.data), new Date().toISOString());
    response.status(204).end();
  });
  return router;
};
