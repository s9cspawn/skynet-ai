import { ChangeDetectionStrategy, Component, computed, HostListener, inject, OnDestroy, OnInit, signal } from '@angular/core';
import { ChatComponent } from './components/chat/chat';
import { PromptInput } from './components/prompt-input/prompt-input';
import { SettingsComponent } from './components/settings/settings';
import { Sidebar } from './components/sidebar/sidebar';
import type { ChatMessage, ChatSettings } from './models/chat.models';
import { ChatService, ChatStreamError } from './services/chat.service';
import { ConversationService } from './services/conversation.service';
import { HealthService } from './services/health.service';
import { SettingsService } from './services/settings.service';

@Component({
  selector: 'app-root', standalone: true, imports: [Sidebar, ChatComponent, PromptInput, SettingsComponent],
  templateUrl: './app.html', styleUrl: './app.scss', changeDetection: ChangeDetectionStrategy.OnPush,
})
export class App implements OnInit, OnDestroy {
  readonly conversations = inject(ConversationService);
  readonly settings = inject(SettingsService);
  readonly health = inject(HealthService);
  private readonly chat = inject(ChatService);
  readonly generating = signal(false);
  readonly sidebarOpen = signal(false);
  readonly settingsOpen = signal(false);
  readonly online = computed(() => this.health.status()?.llama === 'ok');
  readonly modelName = computed(() => this.health.status()?.model ?? 'Local model');
  readonly localInference = computed(() => this.health.status()?.localInference === true);
  private activeController?: AbortController;

  ngOnInit(): void { this.health.start(); }
  ngOnDestroy(): void { this.stop(); this.health.stop(); }

  @HostListener('window:keydown', ['$event'])
  keyboardShortcuts(event: KeyboardEvent): void {
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'n') { event.preventDefault(); this.newConversation(); }
  }

  newConversation(): void { this.stop(); this.conversations.create(); this.sidebarOpen.set(false); }
  selectConversation(id: string): void { this.stop(); this.conversations.select(id); this.sidebarOpen.set(false); }
  deleteConversation(id: string): void { if (this.conversations.activeId() === id) this.stop(); this.conversations.delete(id); }
  clearConversation(): void { this.stop(); this.conversations.clearActive(); }

  async send(content: string): Promise<void> {
    if (this.generating()) return;
    this.conversations.addMessage({ role: 'user', content });
    await this.generate();
  }

  async regenerate(messageId: string): Promise<void> {
    if (this.generating()) return;
    this.conversations.truncateFromMessage(messageId);
    await this.generate();
  }

  stop(): void { this.activeController?.abort(); this.activeController = undefined; this.generating.set(false); }
  saveSettings(value: ChatSettings): void { this.settings.update(value); this.settingsOpen.set(false); }
  resetSettings(): void { this.settings.reset(); }

  private async generate(): Promise<void> {
    const conversation = this.conversations.activeConversation();
    if (!conversation || !conversation.messages.some((message) => message.role === 'user')) return;
    const assistant = this.conversations.addMessage({ role: 'assistant', content: '' });
    const messages = this.conversations.activeConversation()?.messages.filter((message) => message.id !== assistant.id) ?? [];
    const controller = new AbortController();
    this.activeController = controller;
    this.generating.set(true);
    try {
      await this.chat.streamChat(messages, this.settings.settings(), controller.signal, (chunk) => this.conversations.appendToMessage(assistant.id, chunk));
      if (!this.findMessage(assistant.id)?.content) this.conversations.updateMessage(assistant.id, { content: 'The model completed without returning text.', error: true });
    } catch (error) {
      if (controller.signal.aborted) {
        if (!this.findMessage(assistant.id)?.content) this.conversations.updateMessage(assistant.id, { content: '*Generation stopped.*' });
      } else {
        const message = error instanceof ChatStreamError ? error.message : 'Unable to contact Skynet. Check that llama-server is running on 127.0.0.1:8080.';
        this.conversations.updateMessage(assistant.id, { content: message, error: true });
      }
    } finally {
      this.conversations.persist();
      if (this.activeController === controller) this.activeController = undefined;
      this.generating.set(false);
    }
  }

  private findMessage(id: string): ChatMessage | undefined {
    return this.conversations.activeConversation()?.messages.find((message) => message.id === id);
  }
}
