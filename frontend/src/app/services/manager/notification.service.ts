import { Injectable, OnDestroy } from '@angular/core';
import { Subject } from 'rxjs';
import { Client } from '@stomp/stompjs';
import SockJS from 'sockjs-client';

import { Notification } from '../../shared/models/notification.model';
import { environment } from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class NotificationService implements OnDestroy {

  private client: Client;
  private notificationHistory: Notification[] = [];
  private notificationsSubject = new Subject<Notification>();
  notifications$ = this.notificationsSubject.asObservable();

  constructor() {
    this.client = new Client({
      webSocketFactory: () => new SockJS(environment.wsUrl),
      reconnectDelay: 5000,
      onConnect: () => {
        this.client.subscribe('/topic/notifications', (message) => {
          const notification: Notification = JSON.parse(message.body);
          this.publishNotification(notification);
        });
      }
    });
    this.client.activate();
  }

  pushLocal(notification: Notification): void {
    this.publishNotification(notification);
  }

  getSnapshot(): Notification[] {
    return [...this.notificationHistory];
  }

  ngOnDestroy(): void {
    this.client.deactivate();
  }

  private publishNotification(notification: Notification): void {
    this.notificationHistory = [notification, ...this.notificationHistory].slice(0, 100);
    this.notificationsSubject.next(notification);
  }
}
