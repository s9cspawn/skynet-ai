import { ChangeDetectionStrategy, Component, ElementRef, input, output, viewChild } from '@angular/core';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';

@Component({
  selector: 'app-prompt-input', standalone: true, imports: [ReactiveFormsModule],
  templateUrl: './prompt-input.html', styleUrl: './prompt-input.scss', changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PromptInput {
  readonly generating = input(false);
  readonly online = input(false);
  readonly localInference = input(false);
  readonly send = output<string>();
  readonly stop = output<void>();
  readonly textarea = viewChild<ElementRef<HTMLTextAreaElement>>('textarea');
  readonly prompt = new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.maxLength(100_000)] });

  submit(): void {
    const value = this.prompt.value.trim();
    if (!value || this.generating()) return;
    this.send.emit(value);
    this.prompt.setValue('');
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
}
