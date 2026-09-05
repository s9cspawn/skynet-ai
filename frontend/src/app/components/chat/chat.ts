import { AfterViewChecked, ChangeDetectionStrategy, Component, ElementRef, input, output, viewChild } from '@angular/core';
import type { ChatMessage } from '../../models/chat.models';
import { MessageComponent } from '../message/message';

@Component({ selector: 'app-chat', standalone: true, imports: [MessageComponent], templateUrl: './chat.html', styleUrl: './chat.scss', changeDetection: ChangeDetectionStrategy.OnPush })
export class ChatComponent implements AfterViewChecked {
  readonly messages = input.required<ChatMessage[]>();
  readonly generating = input(false);
  readonly suggest = output<string>();
  readonly regenerate = output<string>();
  readonly scrollArea = viewChild<ElementRef<HTMLElement>>('scrollArea');
  private lastSignature = '';
  readonly suggestions = [
    { icon: '⌘', title: 'Explain a command', prompt: 'Explain this Linux command and its flags: ' },
    { icon: '⌁', title: 'Troubleshoot Kubernetes', prompt: 'Help me troubleshoot a Kubernetes issue. Start by asking what symptoms I see.' },
    { icon: '{ }', title: 'Write a Python script', prompt: 'Write a Python script that ' },
    { icon: '◎', title: 'Explain networking', prompt: 'Explain a networking concept using a practical example.' },
  ];

  ngAfterViewChecked(): void {
    const messages = this.messages();
    const last = messages.at(-1);
    const signature = `${messages.length}:${last?.content.length ?? 0}:${this.generating()}`;
    if (signature === this.lastSignature) return;
    this.lastSignature = signature;
    const element = this.scrollArea()?.nativeElement;
    if (!element) return;
    if (typeof element.scrollTo === 'function') {
      element.scrollTo({ top: element.scrollHeight, behavior: this.generating() ? 'auto' : 'smooth' });
    } else {
      element.scrollTop = element.scrollHeight;
    }
  }
}
