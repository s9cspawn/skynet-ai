import type { NextFunction, Request, Response } from 'express';
import { AuthService } from '../services/auth.service.js';

export const SESSION_COOKIE = 'skynet_session';
export const authService = new AuthService();

export const readCookie = (request: Request, name: string): string | null => {
  const raw = request.headers.cookie;
  if (!raw) return null;
  for (const part of raw.split(';')) {
    const [key, ...value] = part.trim().split('=');
    if (key === name) return decodeURIComponent(value.join('='));
  }
  return null;
};

export const requireAuth = (request: Request, response: Response, next: NextFunction): void => {
  const token = readCookie(request, SESSION_COOKIE);
  const user = token ? authService.userForToken(token) : null;
  if (!user) { response.status(401).json({ error: 'Authentication required.' }); return; }
  response.locals['user'] = user;
  next();
};
