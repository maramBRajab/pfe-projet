import { CommonModule, DatePipe } from '@angular/common';
import { Component, EventEmitter, HostListener, Input, OnDestroy, OnInit, Output } from '@angular/core';
import { Subscription } from 'rxjs';

import { Notification } from '../../../shared/models/notification.model';
import { NotificationService } from '../../../services/manager';

@Component({
  selector: 'app-admin-notifications-panel',
  standalone: true,
  imports: [CommonModule, DatePipe],
  templateUrl: './notifications-panel.component.html',
  styleUrl: './notifications-panel.component.scss'
})
export class AdminNotificationsPanelComponent implements OnInit, OnDestroy {
  @Input() open = false;
  @Output() close = new EventEmitter<void>();

  currentDate = new Date();
  lastUpdated = new Date();
  notifications: Notification[] = [];
  private subscription?: Subscription;

  constructor(private readonly notificationService: NotificationService) {}

  @HostListener('document:keydown.escape')
  onEscapeKey(): void {
    if (this.open) {
      this.requestClose();
    }
  }

  ngOnInit(): void {
    this.refreshNotifications();
    this.subscription = this.notificationService.notifications$.subscribe((notification) => {
      this.notifications = [notification, ...this.notifications];
      this.lastUpdated = new Date();
    });
  }

  ngOnDestroy(): void {
    this.subscription?.unsubscribe();
  }

  get infoCount(): number {
    return this.notifications.filter((notification) => this.notificationTone(notification) === 'info').length;
  }

  get warningCount(): number {
    return this.notifications.filter((notification) => this.notificationTone(notification) === 'warning').length;
  }

  get dangerCount(): number {
    return this.notifications.filter((notification) => this.notificationTone(notification) === 'danger').length;
  }

  get todayCount(): number {
    const today = new Date();

    return this.notifications.filter((notification) => {
      const date = this.parseNotificationDate(notification);

      return date.getDate() === today.getDate()
        && date.getMonth() === today.getMonth()
        && date.getFullYear() === today.getFullYear();
    }).length;
  }

  get criticalRate(): number {
    if (!this.notifications.length) {
      return 0;
    }

    return Math.round((this.dangerCount / this.notifications.length) * 100);
  }

  get activeTypesCount(): number {
    return new Set(
      this.notifications
        .map((notification) => notification.type?.trim())
        .filter((type): type is string => !!type)
    ).size;
  }

  get latestNotificationLabel(): string {
    const latestNotification = this.getLatestNotification();

    if (!latestNotification) {
      return 'Aucune nouvelle alerte';
    }

    return `${this.notificationLabel(latestNotification)} · ${latestNotification.titre}`;
  }

  get statusTone(): 'good' | 'watch' | 'risk' {
    if (this.dangerCount > 0) {
      return 'risk';
    }

    if (this.warningCount > 0) {
      return 'watch';
    }

    return 'good';
  }

  get statusLabel(): string {
    if (this.dangerCount > 0) {
      return `${this.dangerCount} critique(s) a traiter`;
    }

    if (this.warningCount > 0) {
      return `${this.warningCount} vigilance(s) en cours`;
    }

    return 'Flux operationnel';
  }

  requestClose(): void {
    this.close.emit();
  }

  refreshNotifications(): void {
    this.notifications = this.notificationService.getSnapshot();
    this.lastUpdated = new Date();
  }

  notificationTone(notification: Notification): 'info' | 'warning' | 'danger' {
    const niveau = notification.niveau.toLowerCase();

    if (niveau.includes('danger') || niveau.includes('error') || niveau.includes('crit')) {
      return 'danger';
    }

    if (niveau.includes('warn') || niveau.includes('attention')) {
      return 'warning';
    }

    return 'info';
  }

  notificationLabel(notification: Notification): string {
    switch (this.notificationTone(notification)) {
      case 'danger':
        return 'Critique';
      case 'warning':
        return 'Vigilance';
      default:
        return 'Information';
    }
  }

  trackByNotification(index: number, notification: Notification): string {
    return `${notification.type}-${notification.dateCreation}-${index}`;
  }

  private getLatestNotification(): Notification | null {
    if (!this.notifications.length) {
      return null;
    }

    return this.notifications.reduce<Notification | null>((latest, notification) => {
      if (!latest) {
        return notification;
      }

      return this.parseNotificationDate(notification).getTime() > this.parseNotificationDate(latest).getTime()
        ? notification
        : latest;
    }, null);
  }

  private parseNotificationDate(notification: Notification): Date {
    const parsedDate = new Date(notification.dateCreation);
    return Number.isNaN(parsedDate.getTime()) ? new Date() : parsedDate;
  }
}