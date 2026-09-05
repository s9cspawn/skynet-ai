import { HttpClient } from '@angular/common/http';
import { inject, Injectable, signal } from '@angular/core';
import { Subscription, timer } from 'rxjs';
import { switchMap } from 'rxjs/operators';
import type { HealthStatus } from '../models/chat.models';

@Injectable({ providedIn: 'root' })
export class HealthService {
  private readonly http = inject(HttpClient);
  private subscription?: Subscription;
  readonly status = signal<HealthStatus | null>(null);
  readonly checking = signal(true);

  start(): void {
    if (this.subscription) return;
    this.subscription = timer(0, 20_000)
      .pipe(switchMap(() => this.http.get<HealthStatus>('/api/health')))
      .subscribe({
        next: (status) => {
          this.status.set(status);
          this.checking.set(false);
        },
        error: () => {
          this.status.set(null);
          this.checking.set(false);
          this.subscription?.unsubscribe();
          this.subscription = undefined;
          window.setTimeout(() => this.start(), 20_000);
        },
      });
  }

  stop(): void {
    this.subscription?.unsubscribe();
    this.subscription = undefined;
  }
}
