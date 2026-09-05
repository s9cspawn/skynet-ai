import { Router } from 'express';
import { z } from 'zod';
import { config } from '../config.js';
import { authService, readCookie, SESSION_COOKIE } from '../middleware/auth.js';

const credentials = z.object({ email: z.email().max(254), password: z.string().min(8).max(128) });
const registration = credentials.extend({ name: z.string().trim().min(2).max(80) });
const cookie = (token: string, secure: boolean): string => `${SESSION_COOKIE}=${encodeURIComponent(token)}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${config.sessionDays * 86400}${secure ? '; Secure' : ''}`;

export const createAuthRouter = (): Router => {
  const router = Router();
  router.post('/register', async (request, response) => {
    const parsed = registration.safeParse(request.body);
    if (!parsed.success) { response.status(400).json({ error: 'Enter a valid name, email, and password of at least 8 characters.' }); return; }
    try {
      const result = await authService.register(parsed.data.name, parsed.data.email, parsed.data.password);
      response.setHeader('set-cookie', cookie(result.token, request.secure));
      response.status(201).json({ user: result.user });
    } catch (error) {
      const duplicate = error instanceof Error && error.message.includes('UNIQUE');
      response.status(duplicate ? 409 : 500).json({ error: duplicate ? 'An account with this email already exists.' : 'Unable to create the account.' });
    }
  });
  router.post('/login', async (request, response) => {
    const parsed = credentials.safeParse(request.body);
    if (!parsed.success) { response.status(400).json({ error: 'Enter a valid email and password.' }); return; }
    const result = await authService.login(parsed.data.email, parsed.data.password);
    if (!result) { response.status(401).json({ error: 'Email or password is incorrect.' }); return; }
    response.setHeader('set-cookie', cookie(result.token, request.secure));
    response.json({ user: result.user });
  });
  router.post('/logout', (request, response) => {
    const token = readCookie(request, SESSION_COOKIE);
    if (token) authService.logout(token);
    response.setHeader('set-cookie', `${SESSION_COOKIE}=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0${request.secure ? '; Secure' : ''}`);
    response.status(204).end();
  });
  router.get('/me', (request, response) => {
    const token = readCookie(request, SESSION_COOKIE);
    const user = token ? authService.userForToken(token) : null;
    if (!user) { response.status(401).json({ error: 'Authentication required.' }); return; }
    response.json({ user });
  });
  return router;
};
