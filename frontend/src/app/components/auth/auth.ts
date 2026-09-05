import { ChangeDetectionStrategy, Component, output, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';

export interface AuthSubmission { mode: 'login' | 'register'; name: string; email: string; password: string; }

@Component({ selector: 'app-auth', standalone: true, imports: [ReactiveFormsModule], templateUrl: './auth.html', styleUrl: './auth.scss', changeDetection: ChangeDetectionStrategy.OnPush })
export class AuthComponent {
  readonly submitAuth = output<AuthSubmission>();
  readonly busy = signal(false);
  readonly error = signal('');
  readonly mode = signal<'login' | 'register'>('login');
  readonly form = new FormGroup({
    name: new FormControl('', { nonNullable: true }),
    email: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.email] }),
    password: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.minLength(8)] }),
  });

  switchMode(mode: 'login' | 'register'): void { this.mode.set(mode); this.error.set(''); }
  submit(): void {
    if (this.form.invalid || (this.mode() === 'register' && this.form.controls.name.value.trim().length < 2)) return;
    this.submitAuth.emit({ mode: this.mode(), name: this.form.controls.name.value, email: this.form.controls.email.value, password: this.form.controls.password.value });
  }
}
