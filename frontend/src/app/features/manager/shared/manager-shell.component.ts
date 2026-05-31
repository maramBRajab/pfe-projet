import { CommonModule } from '@angular/common';
import { Component, HostListener, Input } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../../services/auth';
import { environment } from '../../../../environments/environment';
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
  imports: [CommonModule, RouterLink, ManagerNotificationsPanelComponent],
  templateUrl: './manager-shell.component.html',
  styleUrl: './manager-shell.component.scss'
})
export class ManagerShellComponent {
  @Input() disabled = false;
  @Input() activeSection: ManagerShellSection = 'dashboard';
  @Input() projectBadge: number | null = null;
  @Input() collaboratorBadge: number | null = null;
  @Input() searchPlaceholder = 'Rechercher dans l’espace manager…';

  constructor(
    private readonly authService: AuthService,
    private readonly router: Router,
    readonly notificationsPanel: ManagerNotificationsPanelService
  ) {}

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
