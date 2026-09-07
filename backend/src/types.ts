export type ChatRole = 'system' | 'user' | 'assistant';

export type ProviderContent = string | Array<
  { type: 'text'; text: string } |
  { type: 'image_url'; image_url: { url: string } }
>;

export interface ProviderMessage {
  role: ChatRole;
  content: ProviderContent;
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
