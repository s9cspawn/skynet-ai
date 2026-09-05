import { Injectable } from '@angular/core';
import type { ChatMessage, ChatSettings } from '../models/chat.models';

interface ChatChunk {
  choices?: Array<{ delta?: { content?: string } }>;
  error?: string;
}

export class ChatStreamError extends Error {}

@Injectable({ providedIn: 'root' })
export class ChatService {
  async streamChat(
    messages: ChatMessage[],
    settings: ChatSettings,
    signal: AbortSignal,
    onChunk: (text: string) => void,
  ): Promise<void> {
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'text/event-stream' },
      body: JSON.stringify({
        messages: [
          { role: 'system', content: settings.systemPrompt },
          ...messages.filter((message) => !message.error).map(({ role, content }) => ({ role, content })),
        ],
        temperature: settings.temperature,
        topP: settings.topP,
        maxTokens: settings.maxTokens,
      }),
      signal,
    });

    if (!response.ok) {
      const body = await response.json().catch(() => null) as { error?: string } | null;
      throw new ChatStreamError(body?.error ?? `The local AI request failed (${response.status}).`);
    }
    if (!response.body) throw new ChatStreamError('The browser could not read the model stream.');

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      buffer += decoder.decode(value, { stream: !done }).replace(/\r\n/g, '\n');
      const events = buffer.split('\n\n');
      buffer = events.pop() ?? '';
      for (const event of events) this.processEvent(event, onChunk);
      if (done) break;
    }
    if (buffer.trim()) this.processEvent(buffer, onChunk);
  }

  private processEvent(event: string, onChunk: (text: string) => void): void {
    const lines = event.split('\n');
    const eventType = lines.find((line) => line.startsWith('event:'))?.slice(6).trim();
    const payload = lines
      .filter((line) => line.startsWith('data:'))
      .map((line) => line.slice(5).trimStart())
      .join('\n')
      .trim();
    if (!payload || payload === '[DONE]') return;

    try {
      const parsed = JSON.parse(payload) as ChatChunk;
      if (eventType === 'error' || parsed.error) throw new ChatStreamError(parsed.error ?? 'The model stream was interrupted.');
      const chunk = parsed.choices?.[0]?.delta?.content;
      if (chunk) onChunk(chunk);
    } catch (error) {
      if (error instanceof ChatStreamError) throw error;
      throw new ChatStreamError('The local model returned a malformed streaming response.');
    }
  }
}
