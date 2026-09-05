import { Injectable } from '@angular/core';
import type { Conversation } from '../models/chat.models';

export abstract class ConversationStorage {
  abstract load(): Conversation[];
  abstract save(conversations: Conversation[]): void;
}

interface StoredMessage {
  id: string;
  role: 'system' | 'user' | 'assistant';
  content: string;
  createdAt: string;
  error?: boolean;
}

interface StoredConversation {
  id: string;
  title: string;
  messages: StoredMessage[];
  createdAt: string;
  updatedAt: string;
}

@Injectable({ providedIn: 'root' })
export class LocalStorageConversationStorage extends ConversationStorage {
  private readonly key = 'local-ai.conversations.v1';

  load(): Conversation[] {
    try {
      const raw = localStorage.getItem(this.key);
      if (!raw) return [];
      const stored = JSON.parse(raw) as StoredConversation[];
      if (!Array.isArray(stored)) return [];
      return stored.map((conversation) => ({
        ...conversation,
        createdAt: new Date(conversation.createdAt),
        updatedAt: new Date(conversation.updatedAt),
        messages: conversation.messages.map((message) => ({
          ...message,
          createdAt: new Date(message.createdAt),
        })),
      }));
    } catch {
      return [];
    }
  }

  save(conversations: Conversation[]): void {
    localStorage.setItem(this.key, JSON.stringify(conversations));
  }
}
