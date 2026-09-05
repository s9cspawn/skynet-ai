import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import type { ChatMessage } from '../../models/chat.models';
import { MarkdownService } from '../../services/markdown.service';

@Component({
  selector: 'app-message',
  standalone: true,
  templateUrl: './message.html',
  styleUrl: './message.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MessageComponent {
  private readonly markdown = inject(MarkdownService);
  readonly message = input.required<ChatMessage>();
  readonly generating = input(false);
  readonly regenerate = output<string>();
  readonly rendered = computed(() => this.markdown.render(this.message().content));
  readonly time = computed(() => this.message().createdAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
  copied = false;

  async copyMessage(): Promise<void> {
    await navigator.clipboard.writeText(this.message().content);
    this.copied = true;
    window.setTimeout(() => this.copied = false, 1400);
  }

  async contentClick(event: MouseEvent): Promise<void> {
    const target = event.target as HTMLElement;
    const button = target.closest<HTMLButtonElement>('[data-copy-code]');
    if (!button) return;
    const code = button.closest('.code-block')?.querySelector('code')?.textContent ?? '';
    await navigator.clipboard.writeText(code);
    button.textContent = 'Copied';
    window.setTimeout(() => button.textContent = 'Copy', 1400);
  }
}
