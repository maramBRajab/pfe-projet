import { CommonModule } from '@angular/common';
import { Component, HostListener, Input, OnDestroy, OnInit } from '@angular/core';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { Subscription } from 'rxjs';
import { AuthService } from '../../../services/auth';
import { ManagerDashboardService } from '../../../services/manager';
import { ManagerNotificationApiService } from '../../../services/manager/manager-notification-api.service';
import { ManagerNotificationsPanelComponent } from '../notifications/notifications-panel.component';
import { ManagerNotificationsPanelService } from './manager-notifications-panel.service';

export type ManagerShellSection =
  | 'dashboard'
  | 'projets'
  | 'collaborateurs'
  | 'affectation'
  | 'historique'
  | 'charge'
  | 'notifications'
  | 'profil';

@Component({
  selector: 'app-manager-shell',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive, ManagerNotificationsPanelComponent],
  templateUrl: './manager-shell.component.html',
  styleUrl: './manager-shell.component.scss'
})
export class ManagerShellComponent implements OnInit, OnDestroy {
  @Input() disabled = false;
  @Input() activeSection: ManagerShellSection = 'dashboard';
  @Input() projectBadge: number | null = null;
  @Input() collaboratorBadge: number | null = null;
  @Input() searchPlaceholder = 'Rechercher dans l’espace manager…';

  affectationIaBadge: number | null = null;
  notificationBadge: number | null = null;

  private readonly subscriptions = new Subscription();

  constructor(
    private readonly authService: AuthService,
    private readonly router: Router,
    private readonly managerDashboardService: ManagerDashboardService,
    private readonly managerNotificationApiService: ManagerNotificationApiService,
    readonly notificationsPanel: ManagerNotificationsPanelService
  ) {}

  ngOnInit(): void {
    if (this.disabled) {
      return;
    }

    this.subscriptions.add(
      this.managerDashboardService.getStats().subscribe({
        next: (stats) => {
          this.affectationIaBadge = stats.affectationsEnCours;
        },
        error: () => {
          this.affectationIaBadge = null;
        },
      })
    );

    this.subscriptions.add(
      this.managerNotificationApiService.countUnread().subscribe({
        next: (count) => {
          this.notificationBadge = count;
        },
        error: () => {
          this.notificationBadge = null;
        },
      })
    );
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }

  @HostListener('document:keydown.escape')
  onEscapeKey(): void {
    if (this.notificationsPanel.isOpen()) {
      this.notificationsPanel.close();
    }
  }

  toggleNotificationsPanel(): void {
    this.notificationsPanel.toggle();
  }

  logout(): void {
    this.authService.logout();
    void this.router.navigate(['/login']);
  }
}
