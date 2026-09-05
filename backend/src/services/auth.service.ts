import { createHash, randomBytes, randomUUID, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { config } from '../config.js';
import { database } from '../database/database.js';

const scrypt = promisify(scryptCallback);

export interface AuthUser { id: string; name: string; email: string; }

interface UserRow extends AuthUser { password_hash: string; }

const tokenHash = (token: string): string => createHash('sha256').update(token).digest('hex');

export class AuthService {
  async register(name: string, email: string, password: string): Promise<{ user: AuthUser; token: string }> {
    const id = randomUUID();
    const user = { id, name: name.trim(), email: email.trim().toLowerCase() };
    const passwordHash = await this.hashPassword(password);
    database.prepare('INSERT INTO users (id, name, email, password_hash, created_at) VALUES (?, ?, ?, ?, ?)')
      .run(id, user.name, user.email, passwordHash, new Date().toISOString());
    return { user, token: this.createSession(id) };
  }

  async login(email: string, password: string): Promise<{ user: AuthUser; token: string } | null> {
    const row = database.prepare('SELECT id, name, email, password_hash FROM users WHERE email = ?').get(email.trim().toLowerCase()) as UserRow | undefined;
    if (!row || !(await this.verifyPassword(password, row.password_hash))) return null;
    return { user: { id: row.id, name: row.name, email: row.email }, token: this.createSession(row.id) };
  }

  userForToken(token: string): AuthUser | null {
    const row = database.prepare(`SELECT u.id, u.name, u.email FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token_hash = ? AND s.expires_at > ?`)
      .get(tokenHash(token), new Date().toISOString()) as AuthUser | undefined;
    return row ?? null;
  }

  logout(token: string): void { database.prepare('DELETE FROM sessions WHERE token_hash = ?').run(tokenHash(token)); }

  private createSession(userId: string): string {
    const token = randomBytes(32).toString('base64url');
    const expires = new Date(Date.now() + config.sessionDays * 86_400_000).toISOString();
    database.prepare('INSERT INTO sessions (token_hash, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)')
      .run(tokenHash(token), userId, expires, new Date().toISOString());
    database.prepare('DELETE FROM sessions WHERE expires_at <= ?').run(new Date().toISOString());
    return token;
  }

  private async hashPassword(password: string): Promise<string> {
    const salt = randomBytes(16);
    const derived = await scrypt(password, salt, 64) as Buffer;
    return `scrypt:${salt.toString('base64url')}:${derived.toString('base64url')}`;
  }

  private async verifyPassword(password: string, encoded: string): Promise<boolean> {
    const [, saltValue, hashValue] = encoded.split(':');
    if (!saltValue || !hashValue) return false;
    const expected = Buffer.from(hashValue, 'base64url');
    const actual = await scrypt(password, Buffer.from(saltValue, 'base64url'), expected.length) as Buffer;
    return actual.length === expected.length && timingSafeEqual(actual, expected);
  }
}
