import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import {
  LucideAlertCircle,
  LucideAlertTriangle,
  LucideBell,
  LucideInfo
} from '@lucide/angular';
import { ManagerShellComponent } from '../shared/manager-shell.component';
import { ManagerTopbarComponent } from '../shared/manager-topbar.component';

import { AuthService } from '../../../services/auth';
import {
  ManagerNotificationApiService,
  ManagerNotification
} from '../../../services/manager';

import { KpiCardComponent } from '../../../shared/kpi-card/kpi-card.component';
@Component({
  selector: 'app-manager-notifications-page',
  standalone: true,
  imports: [CommonModule, KpiCardComponent, ManagerShellComponent, ManagerTopbarComponent],
  templateUrl: './notifications.component.html',
  styleUrl: './notifications.component.scss'
})
export class ManagerNotificationsPageComponent implements OnInit {
  readonly bellIcon = LucideBell;
  readonly alertTriangleIcon = LucideAlertTriangle;
  readonly infoIcon = LucideInfo;
  readonly alertCircleIcon = LucideAlertCircle;

  stats = { total: 0, vigilances: 0, informations: 0, critiques: 0 };
  notifications: ManagerNotification[] = [];
  isLoading = false;
  errorMessage = '';
  unreadCount = 0;

  constructor(
    private readonly auth: AuthService,
    private readonly router: Router,
    private readonly api: ManagerNotificationApiService
  ) {}

  ngOnInit(): void {
    this.refresh();
  }

  get notifCount(): number {
    return this.notifications.filter(n => !n.lu).length;
  }

  refresh(): void {
    this.isLoading = true;
    this.errorMessage = '';
    this.api.list().subscribe({
      next: (data) => {
        this.notifications = data ?? [];
        this.computeStats();
        this.unreadCount = this.notifications.filter(n => !n.lu).length;
        this.isLoading = false;
      },
      error: (err) => {
        console.error('Erreur chargement notifications:', err);
        this.errorMessage = 'Impossible de charger les notifications.';
        this.isLoading = false;
      }
    });
  }

  computeStats(): void {
    this.stats.total        = this.notifications.length;
    this.stats.vigilances   = this.notifications.filter(n => n.type === 'VIGILANCE').length;
    this.stats.informations = this.notifications.filter(n => ['INFO', 'IA', 'AFFECTATION'].includes(n.type)).length;
    this.stats.critiques    = this.notifications.filter(n => n.type === 'CRITIQUE').length;
  }

  markAllRead(): void {
    const unreadKeys = this.notifications
      .filter(n => !n.lu)
      .map(n => n.notificationKey)
      .filter(k => !!k);

    if (unreadKeys.length === 0) {
      return;
    }

    this.api.markAllRead(unreadKeys).subscribe({
      next: () => {
        this.notifications = this.notifications.map(n => ({ ...n, lu: true }));
        this.unreadCount = 0;
      },
      error: (err) => {
        console.error('Erreur mark-all-read:', err);
        // Mise à jour locale de secours
        this.notifications = this.notifications.map(n => ({ ...n, lu: true }));
        this.unreadCount = 0;
      }
    });
  }

  logout(): void {
    this.auth.logout();
    void this.router.navigate(['/login']);
  }
}
