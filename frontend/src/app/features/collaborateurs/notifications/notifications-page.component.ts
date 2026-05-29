import { CommonModule, DatePipe } from '@angular/common';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { Subscription } from 'rxjs';

import { Notification } from '../../../shared/models/notification.model';
import { NotificationService } from '../../../services/collaborateur';
import { CollaborateurShellComponent } from '../shared/collaborateur-shell.component';

@Component({
  selector: 'app-collab-notifications-page',
  standalone: true,
  imports: [CommonModule, DatePipe, CollaborateurShellComponent],
  templateUrl: './notifications-page.component.html',
  styleUrl: './notifications-page.component.scss',
})
export class CollaborateurNotificationsPageComponent implements OnInit, OnDestroy {
  currentDate = new Date();
  lastUpdated = new Date();
  notifications: Notification[] = [];
  activeFilter: 'all' | 'danger' | 'warning' | 'info' = 'all';
  readIds = new Set<string>();

  private subscription?: Subscription;

  constructor(private readonly notificationService: NotificationService) {}

  ngOnInit(): void {
    this.notifications = this.notificationService.getSnapshot();
    if (this.notifications.length === 0) {
      this.notifications = this.buildDemoNotifications();
    }
    this.subscription = this.notificationService.notifications$.subscribe((n) => {
      this.notifications = [n, ...this.notifications];
      this.lastUpdated = new Date();
    });
  }

  private buildDemoNotifications(): Notification[] {
    const now = Date.now();
    return [
      {
        type: 'AFFECTATION',
        titre: 'Nouvelle affectation proposée',
        message: 'Le projet « Migration ERP » attend votre confirmation.',
        niveau: 'WARNING',
        dateCreation: new Date(now - 1000 * 60 * 60 * 2).toISOString()
      },
      {
        type: 'PLANNING',
        titre: 'Charge de travail élevée cette semaine',
        message: 'Vous êtes planifié à 95% sur la semaine du 25 mai.',
        niveau: 'WARNING',
        dateCreation: new Date(now - 1000 * 60 * 60 * 6).toISOString()
      },
      {
        type: 'PROJET',
        titre: 'Mise à jour du projet Clôture Q2',
        message: 'Le manager a ajouté une nouvelle compétence requise.',
        niveau: 'INFO',
        dateCreation: new Date(now - 1000 * 60 * 60 * 24).toISOString()
      }
    ];
  }

  ngOnDestroy(): void {
    this.subscription?.unsubscribe();
  }

  // ── Counts ─────────────────────────────────────────────────

  get totalCount(): number { return this.notifications.length; }

  get infoCount(): number {
    return this.notifications.filter(n => this.tone(n) === 'info').length;
  }

  get warningCount(): number {
    return this.notifications.filter(n => this.tone(n) === 'warning').length;
  }

  get dangerCount(): number {
    return this.notifications.filter(n => this.tone(n) === 'danger').length;
  }

  get filteredNotifications(): Notification[] {
    if (this.activeFilter === 'all')    return this.notifications;
    if (this.activeFilter === 'danger') return this.notifications.filter(n => this.tone(n) === 'danger');
    if (this.activeFilter === 'warning')return this.notifications.filter(n => this.tone(n) === 'warning');
    return this.notifications.filter(n => this.tone(n) === 'info');
  }

  get headerStatusLabel(): string {
    if (this.dangerCount > 0)  return 'Attention immédiate';
    if (this.warningCount > 0) return 'Surveillance active';
    return 'Flux normal';
  }

  get headerStatusIsGreen(): boolean {
    return this.dangerCount === 0 && this.warningCount === 0;
  }

  // ── Actions ────────────────────────────────────────────────

  refresh(): void {
    this.notifications = this.notificationService.getSnapshot();
    this.lastUpdated = new Date();
  }

  markAllRead(): void {
    this.notifications.forEach(n => this.readIds.add(this.trackId(n)));
  }

  markRead(n: Notification): void {
    this.readIds.add(this.trackId(n));
  }

  isRead(n: Notification): boolean {
    return this.readIds.has(this.trackId(n));
  }

  // ── Helpers ────────────────────────────────────────────────

  tone(n: Notification): 'info' | 'warning' | 'danger' {
    const lvl = (n.niveau ?? '').toLowerCase();
    if (lvl.includes('danger') || lvl.includes('error') || lvl.includes('crit')) return 'danger';
    if (lvl.includes('warn')   || lvl.includes('attention'))                       return 'warning';
    return 'info';
  }

  label(n: Notification): string {
    switch (this.tone(n)) {
      case 'danger':  return 'CRITIQUE';
      case 'warning': return 'VIGILANCE';
      default:        return 'INFO';
    }
  }

  iconClass(n: Notification): string {
    switch (this.tone(n)) {
      case 'danger':  return 'ti ti-alert-octagon';
      case 'warning': return 'ti ti-alert-triangle';
      default:        return 'ti ti-info-circle';
    }
  }

  accentColor(n: Notification): string {
    switch (this.tone(n)) {
      case 'danger':  return '#ef4444';
      case 'warning': return '#f59e0b';
      default:        return '#3b82f6';
    }
  }

  bgColor(n: Notification): string {
    switch (this.tone(n)) {
      case 'danger':  return '#fff5f5';
      case 'warning': return '#fffbeb';
      default:        return '#eff6ff';
    }
  }

  borderColor(n: Notification): string {
    switch (this.tone(n)) {
      case 'danger':  return '#fecaca';
      case 'warning': return '#fde68a';
      default:        return '#bfdbfe';
    }
  }

  badgeBg(n: Notification): string {
    switch (this.tone(n)) {
      case 'danger':  return '#fee2e2';
      case 'warning': return '#fef9c3';
      default:        return '#dbeafe';
    }
  }

  badgeColor(n: Notification): string {
    switch (this.tone(n)) {
      case 'danger':  return '#991b1b';
      case 'warning': return '#92400e';
      default:        return '#1e40af';
    }
  }

  parseDate(n: Notification): Date {
    return n.dateCreation ? new Date(n.dateCreation) : new Date();
  }

  trackId(n: Notification): string {
    return `${n.type}-${n.dateCreation}`;
  }

  trackByNotification = (_index: number, n: Notification): string => {
    return this.trackId(n);
  };
}
