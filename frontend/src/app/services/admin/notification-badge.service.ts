import { Injectable, OnDestroy } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Subscription, interval } from 'rxjs';

import { environment } from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class NotificationBadgeService implements OnDestroy {
  private readonly countSubject = new BehaviorSubject<number>(0);
  readonly count$ = this.countSubject.asObservable();

  private pollingSubscription?: Subscription;
  private readonly unreadCountUrl = `${environment.apiUrl}/admin/notifications/unread-count`;

  constructor(private readonly http: HttpClient) {}

  load(): void {
    this.http
      .get<{ count: number }>(this.unreadCountUrl)
      .subscribe({
        next: (res) => this.countSubject.next(Math.max(0, Number(res?.count ?? 0))),
        error: () => {}
      });
  }

  startPolling(intervalMs = 60_000): void {
    this.stopPolling();
    this.pollingSubscription = interval(intervalMs).subscribe(() => this.load());
  }

  stopPolling(): void {
    this.pollingSubscription?.unsubscribe();
    this.pollingSubscription = undefined;
  }

  decrement(by = 1): void {
    const current = this.countSubject.getValue();
    this.countSubject.next(Math.max(0, current - by));
  }

  reset(): void {
    this.countSubject.next(0);
  }

  current(): number {
    return this.countSubject.getValue();
  }

  ngOnDestroy(): void {
    this.stopPolling();
  }
}