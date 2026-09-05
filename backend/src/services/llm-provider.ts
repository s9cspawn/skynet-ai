import type { ChatRequest, ProviderHealth } from '../types.js';

export interface LlmProvider {
  streamChat(request: ChatRequest, signal: AbortSignal): Promise<Response>;
  healthCheck(signal?: AbortSignal): Promise<ProviderHealth>;
}
