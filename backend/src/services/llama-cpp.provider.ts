import { config } from '../config.js';
import type { ChatRequest, ProviderHealth } from '../types.js';
import type { LlmProvider } from './llm-provider.js';

interface ModelListResponse {
  data?: Array<{ id?: string }>;
  models?: Array<{ model?: string; name?: string }>;
}

export class LlamaCppProvider implements LlmProvider {
  private resolvedModel = config.llamaModel;

  async streamChat(request: ChatRequest, signal: AbortSignal): Promise<Response> {
    const timeout = AbortSignal.timeout(config.llamaTimeoutMs);
    const combinedSignal = AbortSignal.any([signal, timeout]);
    this.resolvedModel = await this.discoverModel(AbortSignal.any([signal, AbortSignal.timeout(2_000)]));

    return fetch(`${config.llamaBaseUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'text/event-stream' },
      body: JSON.stringify({
        model: this.resolvedModel,
        messages: request.messages,
        temperature: request.temperature,
        top_p: request.topP,
        max_tokens: request.maxTokens,
        stream: true,
      }),
      signal: combinedSignal,
    });
  }

  async healthCheck(signal = AbortSignal.timeout(4_000)): Promise<ProviderHealth> {
    const available = await this.checkHealthEndpoint(signal);
    if (!available) {
      return { available: false, model: config.llamaModel };
    }

    this.resolvedModel = await this.discoverModel(signal);
    return { available: true, model: this.resolvedModel };
  }

  private async checkHealthEndpoint(signal: AbortSignal): Promise<boolean> {
    for (const path of ['/health', '/v1/health']) {
      try {
        const response = await fetch(`${config.llamaBaseUrl}${path}`, { signal });
        if (response.ok) return true;
      } catch {
        // Some llama.cpp builds expose only one of these endpoints.
      }
    }
    return false;
  }

  private async discoverModel(signal: AbortSignal): Promise<string> {
    try {
      const response = await fetch(`${config.llamaBaseUrl}/v1/models`, { signal });
      if (!response.ok) return config.llamaModel;
      const body = (await response.json()) as ModelListResponse;
      return body.data?.[0]?.id ?? body.models?.[0]?.model ?? body.models?.[0]?.name ?? config.llamaModel;
    } catch {
      return config.llamaModel;
    }
  }
}
