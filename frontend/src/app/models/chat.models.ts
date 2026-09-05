export type ChatRole = 'system' | 'user' | 'assistant';

export interface ChatMessage {
  id: string;
  role: ChatRole;
  content: string;
  createdAt: Date;
  error?: boolean;
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
