import { ChangeDetectionStrategy, Component, ElementRef, input, output, signal, viewChild } from '@angular/core';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import type { ChatAttachment, ChatDraft } from '../../models/chat.models';

@Component({
  selector: 'app-prompt-input', standalone: true, imports: [ReactiveFormsModule],
  templateUrl: './prompt-input.html', styleUrl: './prompt-input.scss', changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PromptInput {
  private static readonly maxImageDimension = 512;
  private static readonly imageQuality = 0.82;
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
      if (file.type.startsWith('image/')) {
        const image = await this.prepareImage(file);
        attachment.dataUrl = image.dataUrl;
        attachment.type = image.type;
        attachment.size = image.size;
      }
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

  private async prepareImage(file: File): Promise<{ dataUrl: string; size: number; type: string }> {
    const objectUrl = URL.createObjectURL(file);
    try {
      const image = await new Promise<HTMLImageElement>((resolve, reject) => {
        const element = new Image();
        element.onload = () => resolve(element);
        element.onerror = () => reject(new Error(`Could not prepare ${file.name}.`));
        element.src = objectUrl;
      });
      const scale = Math.min(1, PromptInput.maxImageDimension / Math.max(image.naturalWidth, image.naturalHeight));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
      canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
      const context = canvas.getContext('2d');
      if (!context) throw new Error(`Could not prepare ${file.name}.`);
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob((result) => result ? resolve(result) : reject(new Error(`Could not compress ${file.name}.`)), 'image/jpeg', PromptInput.imageQuality);
      });
      return { dataUrl: await this.readAsDataUrl(blob), size: blob.size, type: blob.type };
    } finally {
      URL.revokeObjectURL(objectUrl);
    }
  }

  private readAsDataUrl(file: Blob): Promise<string> {
    return new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = () => reject(reader.error); reader.readAsDataURL(file); });
  }
}
