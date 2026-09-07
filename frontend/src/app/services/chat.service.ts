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
          ...messages.filter((message) => !message.error).map(({ role, content, attachments }) => ({ role, content: this.promptContent(content, attachments) })),
        ],
        temperature: settings.temperature,
        topP: settings.topP,
        maxTokens: settings.maxTokens,
      }),
      signal,
    });

    if (!response.ok) {
      const body = await response.json().catch(() => null) as { error?: string } | null;
      throw new ChatStreamError(body?.error ?? `The Skynet request failed (${response.status}).`);
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

  private promptContent(content: string, attachments?: ChatMessage['attachments']): string | Array<{ type: 'text'; text: string } | { type: 'image_url'; image_url: { url: string } }> {
    if (!attachments?.length) return content;
    const details = attachments.map((attachment) => {
      if (attachment.textContent) return `\n\nAttached text file "${attachment.name}":\n${attachment.textContent.slice(0, 100_000)}`;
      if (attachment.dataUrl) return '';
      return `\n\nAttached file "${attachment.name}" (${attachment.type}; contents not extracted by the browser).`;
    }).join('');
    const parts: Array<{ type: 'text'; text: string } | { type: 'image_url'; image_url: { url: string } }> = attachments
      .filter((attachment) => attachment.dataUrl)
      .map((attachment) => ({ type: 'image_url' as const, image_url: { url: attachment.dataUrl! } }));
    parts.push({ type: 'text', text: `${content || 'Please review the attached file(s).'}${details}` });
    return parts;
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
