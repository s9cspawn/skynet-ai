import { Injectable, signal } from '@angular/core';
import type { User } from '../models/chat.models';

@Injectable({ providedIn: 'root' })
export class AuthService {
  readonly user = signal<User | null>(null);
  readonly loading = signal(true);

  async restore(): Promise<User | null> {
    try {
      const response = await fetch('/api/auth/me');
      if (!response.ok) return null;
      const body = await response.json() as { user: User };
      this.user.set(body.user);
      return body.user;
    } catch { return null; }
    finally { this.loading.set(false); }
  }

  async login(email: string, password: string): Promise<void> { await this.authenticate('/api/auth/login', { email, password }); }
  async register(name: string, email: string, password: string): Promise<void> { await this.authenticate('/api/auth/register', { name, email, password }); }
  async logout(): Promise<void> { await fetch('/api/auth/logout', { method: 'POST' }); this.user.set(null); }

  private async authenticate(path: string, payload: object): Promise<void> {
    const response = await fetch(path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) });
    const body = await response.json().catch(() => ({})) as { user?: User; error?: string };
    if (!response.ok || !body.user) throw new Error(body.error ?? 'Unable to sign in.');
    this.user.set(body.user);
  }
}
