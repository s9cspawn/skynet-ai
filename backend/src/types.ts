export type ChatRole = 'system' | 'user' | 'assistant';

export interface ProviderMessage {
  role: ChatRole;
  content: string;
}

export interface ChatRequest {
  messages: ProviderMessage[];
  temperature: number;
  topP: number;
  maxTokens: number;
}

export interface ProviderHealth {
  available: boolean;
  model: string;
}
