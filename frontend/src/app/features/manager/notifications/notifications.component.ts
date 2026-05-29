import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';

import { AuthService } from '../../../services/auth';
import {
  ManagerNotificationApiService,
  ManagerNotification
} from '../../../services/manager';

@Component({
  selector: 'app-manager-notifications-page',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './notifications.component.html',
  styleUrl: './notifications.component.scss'
})
export class ManagerNotificationsPageComponent implements OnInit {

  stats = { total: 0, vigilances: 0, informations: 0, critiques: 0 };
  notifications: ManagerNotification[] = [];
  isLoading = false;
  errorMessage = '';

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
    this.notifications = this.notifications.map(n => ({ ...n, lu: true }));
  }

  logout(): void {
    this.auth.logout();
    void this.router.navigate(['/login']);
  }
}
