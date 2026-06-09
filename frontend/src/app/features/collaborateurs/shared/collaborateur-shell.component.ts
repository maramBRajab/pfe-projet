import { CommonModule } from '@angular/common';
import { Component, HostListener, Input, OnDestroy, OnInit } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';

import { AuthService } from '../../../services/auth';
import { CollaborateurService } from '../../../services/manager/collaborateur.service';
import { NotificationsPanelComponent } from '../notifications/notifications-panel.component';

export type CollaborateurShellSection =
  | 'dashboard'
  | 'projets'
  | 'affectations'
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
export class CollaborateurShellComponent implements OnInit, OnDestroy {
  @Input() disabled = false;
  @Input() activeSection: CollaborateurShellSection = 'dashboard';
  @Input() searchPlaceholder = 'Rechercher dans mon espace collaborateur…';

  notificationsPanelOpen = false;
  unreadNotificationsCount = 0;

  private readonly subscriptions = new Subscription();

  constructor(
    private readonly authService: AuthService,
    private readonly collaborateurService: CollaborateurService,
    private readonly router: Router
  ) {}

  ngOnInit(): void {
    if (this.disabled) {
      return;
    }

    this.subscriptions.add(
      this.authService.getCurrentProfile().subscribe({
        next: (profile) => {
          this.loadUnreadNotifications(profile.id);
        },
        error: () => {
          const userId = this.authService.currentUser?.id;
          if (userId) {
            this.loadUnreadNotifications(userId);
            return;
          }
          this.unreadNotificationsCount = 0;
        },
      })
    );
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }

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

  private loadUnreadNotifications(userId: number): void {
    this.subscriptions.add(
      this.collaborateurService.getNotifications(userId).subscribe({
        next: (summary) => {
          this.unreadNotificationsCount = summary.notifications.filter((notification) => !notification.lu).length;
        },
        error: () => {
          this.unreadNotificationsCount = 0;
        },
      })
    );
  }
}
