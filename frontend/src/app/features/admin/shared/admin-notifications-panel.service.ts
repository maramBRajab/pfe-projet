import { Injectable, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class AdminNotificationsPanelService {
  readonly isOpen = signal(false);
  readonly notificationCount = signal(0);

  open(): void {
    this.isOpen.set(true);
  }

  close(): void {
    this.isOpen.set(false);
  }

  toggle(): void {
    this.isOpen.update((value) => !value);
  }
}