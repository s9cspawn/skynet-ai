import { Injectable } from '@angular/core';
import { DomSanitizer, type SafeHtml } from '@angular/platform-browser';
import DOMPurify from 'dompurify';
import { marked } from 'marked';

@Injectable({ providedIn: 'root' })
export class MarkdownService {
  constructor(private readonly sanitizer: DomSanitizer) {}

  render(markdown: string): SafeHtml {
    const raw = marked.parse(markdown, { gfm: true, breaks: true }) as string;
    const firstPass = DOMPurify.sanitize(raw, {
      USE_PROFILES: { html: true },
      ADD_ATTR: ['target', 'rel'],
    });
    const document = new DOMParser().parseFromString(`<div>${firstPass}</div>`, 'text/html');
    for (const pre of document.querySelectorAll('pre')) {
      const code = pre.querySelector('code');
      const language = [...(code?.classList ?? [])]
        .find((name) => name.startsWith('language-'))
        ?.replace('language-', '') ?? 'code';
      const wrapper = document.createElement('div');
      wrapper.className = 'code-block';
      const header = document.createElement('div');
      header.className = 'code-block__header';
      const label = document.createElement('span');
      label.textContent = language;
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'code-copy';
      button.dataset['copyCode'] = 'true';
      button.setAttribute('aria-label', 'Copy code block');
      button.textContent = 'Copy';
      header.append(label, button);
      pre.before(wrapper);
      wrapper.append(header, pre);
    }
    for (const anchor of document.querySelectorAll('a')) {
      anchor.setAttribute('target', '_blank');
      anchor.setAttribute('rel', 'noopener noreferrer');
    }
    const clean = DOMPurify.sanitize(document.body.firstElementChild?.innerHTML ?? '', {
      USE_PROFILES: { html: true },
      ADD_ATTR: ['target', 'rel', 'data-copy-code'],
    });
    return this.sanitizer.bypassSecurityTrustHtml(clean);
  }
}
