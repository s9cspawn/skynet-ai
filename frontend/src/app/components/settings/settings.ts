import { ChangeDetectionStrategy, Component, input, OnChanges, output } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import type { ChatSettings } from '../../models/chat.models';

@Component({ selector: 'app-settings', standalone: true, imports: [ReactiveFormsModule], templateUrl: './settings.html', styleUrl: './settings.scss', changeDetection: ChangeDetectionStrategy.OnPush })
export class SettingsComponent implements OnChanges {
  readonly settings = input.required<ChatSettings>();
  readonly close = output<void>();
  readonly save = output<ChatSettings>();
  readonly reset = output<void>();
  advanced = false;
  readonly form = new FormGroup({
    systemPrompt: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    temperature: new FormControl(0.7, { nonNullable: true, validators: [Validators.min(0), Validators.max(2)] }),
    topP: new FormControl(0.95, { nonNullable: true, validators: [Validators.min(0), Validators.max(1)] }),
    maxTokens: new FormControl(2048, { nonNullable: true, validators: [Validators.min(1), Validators.max(131072)] }),
  });
  ngOnChanges(): void { this.form.reset(this.settings()); }
  submit(): void { if (this.form.valid) this.save.emit(this.form.getRawValue()); }
}
