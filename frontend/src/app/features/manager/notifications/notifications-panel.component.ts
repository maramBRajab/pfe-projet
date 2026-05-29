import { CommonModule, DatePipe } from '@angular/common';
import { Component, EventEmitter, HostListener, Input, OnDestroy, OnInit, Output } from '@angular/core';
import { Subscription } from 'rxjs';

import { Notification } from '../../../shared/models/notification.model';
import { NotificationService } from '../../../services/manager';

@Component({
  selector: 'app-manager-notifications-panel',
  standalone: true,
  imports: [CommonModule, DatePipe],
  templateUrl: './notifications-panel.component.html',
  styleUrl: './notifications-panel.component.scss'
})
export class ManagerNotificationsPanelComponent implements OnInit, OnDestroy {
  @Input() open = false;
  @Output() close = new EventEmitter<void>();

  currentDate = new Date();
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
    this.notifications = this.notificationService.getSnapshot();
    this.subscription = this.notificationService.notifications$.subscribe((notification) => {
      this.notifications = [notification, ...this.notifications];
    });
  }

  ngOnDestroy(): void {
    this.subscription?.unsubscribe();
  }

  requestClose(): void {
    this.close.emit();
  }

  refreshNotifications(): void {
    this.notifications = this.notificationService.getSnapshot();
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
}