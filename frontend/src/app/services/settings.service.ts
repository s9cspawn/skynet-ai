import { Injectable, signal } from '@angular/core';
import { DEFAULT_SETTINGS } from '../core/constants';
import type { ChatSettings } from '../models/chat.models';

@Injectable({ providedIn: 'root' })
export class SettingsService {
  private readonly key = 'local-ai.settings.v1';
  readonly settings = signal<ChatSettings>(this.load());

  update(settings: ChatSettings): void {
    const normalized: ChatSettings = {
      systemPrompt: settings.systemPrompt.trim() || DEFAULT_SETTINGS.systemPrompt,
      temperature: Math.min(2, Math.max(0, settings.temperature)),
      topP: Math.min(1, Math.max(0, settings.topP)),
      maxTokens: Math.min(131_072, Math.max(1, Math.round(settings.maxTokens))),
    };
    this.settings.set(normalized);
    localStorage.setItem(this.key, JSON.stringify(normalized));
  }

  reset(): void {
    this.update(DEFAULT_SETTINGS);
  }

  private load(): ChatSettings {
    try {
      const parsed = JSON.parse(localStorage.getItem(this.key) ?? 'null') as Partial<ChatSettings> | null;
      return parsed ? { ...DEFAULT_SETTINGS, ...parsed } : { ...DEFAULT_SETTINGS };
    } catch {
      return { ...DEFAULT_SETTINGS };
    }
  }
}
