import { ChangeDetectionStrategy, Component, ElementRef, input, output, signal, viewChild } from '@angular/core';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import type { ChatAttachment, ChatDraft } from '../../models/chat.models';

@Component({
  selector: 'app-prompt-input', standalone: true, imports: [ReactiveFormsModule],
  templateUrl: './prompt-input.html', styleUrl: './prompt-input.scss', changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PromptInput {
  readonly generating = input(false);
  readonly online = input(false);
  readonly localInference = input(false);
  readonly send = output<ChatDraft>();
  readonly stop = output<void>();
  readonly textarea = viewChild<ElementRef<HTMLTextAreaElement>>('textarea');
  readonly prompt = new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.maxLength(100_000)] });
  readonly attachments = signal<ChatAttachment[]>([]);
  readonly fileInput = viewChild<ElementRef<HTMLInputElement>>('fileInput');

  async filesSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const files = Array.from(input.files ?? []);
    for (const file of files) {
      if (file.size > 4 * 1024 * 1024 || this.attachments().reduce((total, item) => total + item.size, 0) + file.size > 12 * 1024 * 1024) continue;
      const attachment: ChatAttachment = { name: file.name, type: file.type || 'application/octet-stream', size: file.size };
      if (file.type.startsWith('image/')) attachment.dataUrl = await this.readAsDataUrl(file);
      else if (file.type.startsWith('text/') || /\.(md|json|csv|ts|js|html|css|xml|yaml|yml|log)$/i.test(file.name)) attachment.textContent = (await file.text()).slice(0, 100_000);
      this.attachments.update(items => [...items, attachment]);
    }
    input.value = '';
  }

  removeAttachment(index: number): void { this.attachments.update(items => items.filter((_, itemIndex) => itemIndex !== index)); }

  submit(): void {
    const value = this.prompt.value.trim();
    if ((!value && !this.attachments().length) || this.generating()) return;
    this.send.emit({ content: value, attachments: this.attachments() });
    this.prompt.setValue('');
    this.attachments.set([]);
    this.resize();
  }

  keydown(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); this.submit(); }
  }

  resize(): void {
    const element = this.textarea()?.nativeElement;
    if (!element) return;
    element.style.height = 'auto';
    element.style.height = `${Math.min(element.scrollHeight, 180)}px`;
  }

  private readAsDataUrl(file: File): Promise<string> {
    return new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = () => reject(reader.error); reader.readAsDataURL(file); });
  }
}
