export type ChatRole = 'system' | 'user' | 'assistant';

export interface ChatAttachment {
  name: string;
  type: string;
  size: number;
  textContent?: string;
}

export interface ChatDraft {
  content: string;
  attachments: ChatAttachment[];
}

export interface ChatMessage {
  id: string;
  role: ChatRole;
  content: string;
  createdAt: Date;
  error?: boolean;
  attachments?: ChatAttachment[];
}

export interface Conversation {
  id: string;
  title: string;
  messages: ChatMessage[];
  createdAt: Date;
  updatedAt: Date;
}

export interface ChatSettings {
  systemPrompt: string;
  temperature: number;
  topP: number;
  maxTokens: number;
}

export interface HealthStatus {
  api: 'ok';
  llama: 'ok' | 'unavailable';
  model: string;
  localInference: boolean;
}

export interface User {
  id: string;
  name: string;
  email: string;
}
