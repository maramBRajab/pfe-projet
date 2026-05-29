import { CommonModule } from '@angular/common';
import { Component, HostListener, Input } from '@angular/core';
import { Router, RouterLink } from '@angular/router';

import { AuthService } from '../../../services/auth';
import { NotificationsPanelComponent } from '../notifications/notifications-panel.component';

export type CollaborateurShellSection =
  | 'dashboard'
  | 'projets'
  | 'planning'
  | 'historique'
  | 'notifications'
  | 'profil';

@Component({
  selector: 'app-collaborateur-shell',
  standalone: true,
  imports: [CommonModule, RouterLink, NotificationsPanelComponent],
  templateUrl: './collaborateur-shell.component.html',
  styleUrl: './collaborateur-shell.component.scss'
})
export class CollaborateurShellComponent {
  @Input() disabled = false;
  @Input() activeSection: CollaborateurShellSection = 'dashboard';
  @Input() searchPlaceholder = 'Rechercher dans mon espace collaborateur…';

  notificationsPanelOpen = false;

  constructor(
    private readonly authService: AuthService,
    private readonly router: Router
  ) {}

  get userInitials(): string {
    const name = this.authService.currentUser?.nom?.trim();
    if (!name) {
      return 'CL';
    }

    return name
      .split(' ')
      .map((part) => part[0] ?? '')
      .join('')
      .slice(0, 2)
      .toUpperCase();
  }

  get userName(): string {
    return this.authService.currentUser?.nom?.trim() || 'Collaborateur';
  }

  @HostListener('document:keydown.escape')
  onEscapeKey(): void {
    if (this.notificationsPanelOpen) {
      this.closeNotificationsPanel();
    }
  }

  toggleNotificationsPanel(): void {
    this.notificationsPanelOpen = !this.notificationsPanelOpen;
  }

  closeNotificationsPanel(): void {
    this.notificationsPanelOpen = false;
  }

  logout(): void {
    this.authService.logout();
    void this.router.navigate(['/login']);
  }
}