import { computed, inject, Injectable, signal } from '@angular/core';
import type { ChatMessage, Conversation } from '../models/chat.models';
import { ConversationStorage, LocalStorageConversationStorage } from './conversation-storage';

const createId = (): string => crypto.randomUUID();

const deriveTitle = (message: string): string => {
  const words = message
    .replace(/[`*_#>\[\]{}()]/g, ' ')
    .replace(/[^\p{L}\p{N}'-]+/gu, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  const ignored = new Set(['a', 'an', 'the', 'to', 'me', 'please', 'can', 'you', 'could', 'would', 'about']);
  const useful = words.filter((word, index) => index === 0 || !ignored.has(word.toLowerCase())).slice(0, 5);
  const titleWords = (useful.length >= 3 ? useful : words).slice(0, 6);
  const title = titleWords.join(' ');
  return title ? title.charAt(0).toUpperCase() + title.slice(1) : 'New conversation';
};

@Injectable({ providedIn: 'root' })
export class ConversationService {
  private readonly storage: ConversationStorage = inject(LocalStorageConversationStorage);
  readonly conversations = signal<Conversation[]>(this.storage.load());
  readonly activeId = signal<string | null>(this.conversations()[0]?.id ?? null);
  readonly activeConversation = computed(() =>
    this.conversations().find((conversation) => conversation.id === this.activeId()) ?? null,
  );

  constructor() {
    if (this.conversations().length === 0) this.create();
  }

  create(): string {
    const now = new Date();
    const conversation: Conversation = {
      id: createId(),
      title: 'New conversation',
      messages: [],
      createdAt: now,
      updatedAt: now,
    };
    this.conversations.update((items) => [conversation, ...items]);
    this.activeId.set(conversation.id);
    this.persist();
    return conversation.id;
  }

  select(id: string): void {
    if (this.conversations().some((conversation) => conversation.id === id)) this.activeId.set(id);
  }

  delete(id: string): void {
    this.conversations.update((items) => items.filter((conversation) => conversation.id !== id));
    if (this.activeId() === id) this.activeId.set(this.conversations()[0]?.id ?? null);
    if (this.conversations().length === 0) this.create();
    this.persist();
  }

  clearActive(): void {
    const id = this.activeId();
    if (!id) return;
    this.updateConversation(id, (conversation) => ({ ...conversation, title: 'New conversation', messages: [] }));
  }

  addMessage(message: Omit<ChatMessage, 'id' | 'createdAt'>): ChatMessage {
    const conversationId = this.ensureActive();
    const newMessage: ChatMessage = { ...message, id: createId(), createdAt: new Date() };
    this.updateConversation(conversationId, (conversation) => ({
      ...conversation,
      title: conversation.messages.some((item) => item.role === 'user') || message.role !== 'user'
        ? conversation.title
        : deriveTitle(message.content),
      messages: [...conversation.messages, newMessage],
    }));
    return newMessage;
  }

  appendToMessage(messageId: string, chunk: string): void {
    const conversationId = this.activeId();
    if (!conversationId) return;
    this.updateConversation(conversationId, (conversation) => ({
      ...conversation,
      messages: conversation.messages.map((message) =>
        message.id === messageId ? { ...message, content: message.content + chunk } : message,
      ),
    }), false);
  }

  updateMessage(messageId: string, patch: Partial<Pick<ChatMessage, 'content' | 'error'>>): void {
    const conversationId = this.activeId();
    if (!conversationId) return;
    this.updateConversation(conversationId, (conversation) => ({
      ...conversation,
      messages: conversation.messages.map((message) => message.id === messageId ? { ...message, ...patch } : message),
    }));
  }

  removeMessage(messageId: string): void {
    const conversationId = this.activeId();
    if (!conversationId) return;
    this.updateConversation(conversationId, (conversation) => ({
      ...conversation,
      messages: conversation.messages.filter((message) => message.id !== messageId),
    }));
  }

  truncateFromMessage(messageId: string): void {
    const conversationId = this.activeId();
    if (!conversationId) return;
    this.updateConversation(conversationId, (conversation) => {
      const index = conversation.messages.findIndex((message) => message.id === messageId);
      return index < 0 ? conversation : { ...conversation, messages: conversation.messages.slice(0, index) };
    });
  }

  persist(): void {
    this.storage.save(this.conversations());
  }

  private ensureActive(): string {
    return this.activeId() ?? this.create();
  }

  private updateConversation(id: string, update: (conversation: Conversation) => Conversation, persist = true): void {
    this.conversations.update((items) => {
      const next = items.map((conversation) =>
        conversation.id === id ? { ...update(conversation), updatedAt: new Date() } : conversation,
      );
      return [...next].sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
    });
    if (persist) this.persist();
  }
}
