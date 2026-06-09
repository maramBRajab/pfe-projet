import { CommonModule } from '@angular/common';
import { Component, HostListener, OnDestroy, OnInit } from '@angular/core';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { Subscription } from 'rxjs';

import { AuthService } from '../../../services/auth';
import { AdminSettingsService } from '../../../services/admin/settings.service';
import { AdminNotificationsPanelService } from './admin-notifications-panel.service';
import { NotificationBadgeService } from '../../../services/admin/notification-badge.service';

@Component({
  selector: 'app-admin-sidebar',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive],
  templateUrl: './admin-sidebar.component.html',
  styleUrl: './admin-sidebar.component.scss'
})
export class AdminSidebarComponent implements OnInit, OnDestroy {

  userInitials    = 'AP';
  userDisplayName = 'Admin Principal';
  userRoleLabel   = 'Administrateur';
  userMenuOpen    = false;
  adminPhoto: string | null = null;
  platformName = '';
  unreadCount = 0;
  private badgeSubscription?: Subscription;

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    const target = event.target as HTMLElement;
    if (!target.closest('.sp-user-block')) {
      this.userMenuOpen = false;
    }
  }

  constructor(
    private readonly authService: AuthService,
    private readonly settingsService: AdminSettingsService,
    private readonly router: Router,
    readonly notificationsPanel: AdminNotificationsPanelService,
    private readonly notificationBadgeService: NotificationBadgeService
  ) {}

  @HostListener('document:keydown.escape')
  onEscapeKey(): void {
    if (this.notificationsPanel.isOpen()) {
      this.notificationsPanel.close();
    }
  }

  ngOnInit(): void {
    this.settingsService.getSettings().subscribe({
      next: (data) => {
        this.platformName = data?.plateforme?.nomPlateforme?.trim() || '';
      },
      error: () => {
        this.platformName = '';
      },
    });

    const user = this.authService.currentUser;
    if (user) {
      this.applyUserProfile(user);
    }

    this.authService.getCurrentProfile().subscribe({
      next: (profile) => this.applyUserProfile(profile),
      error: () => {
        if (!user) {
          this.adminPhoto = null;
          this.userDisplayName = 'Administrateur';
          this.userInitials = 'AP';
          this.userRoleLabel = 'ADMIN';
        }
      },
    });

    this.badgeSubscription = this.notificationBadgeService.count$.subscribe((count) => {
      this.unreadCount = count;
      this.notificationsPanel.notificationCount.set(count);
    });

    this.notificationBadgeService.load();
    this.notificationBadgeService.startPolling();
  }

  ngOnDestroy(): void {
    this.badgeSubscription?.unsubscribe();
    this.notificationBadgeService.stopPolling();
  }

  logout(): void {
    this.authService.logout();
    void this.router.navigate(['/login']);
  }

  private applyUserProfile(user: { nom?: string | null; role?: string | null; photoUrl?: string | null }): void {
    this.adminPhoto = user.photoUrl ?? null;
    const displayName = (user.nom ?? '').trim() || 'Administrateur';
    const parts = displayName.split(/\s+/);
    this.userInitials = parts.length >= 2
      ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
      : displayName.slice(0, 2).toUpperCase();
    this.userDisplayName = displayName;
    this.userRoleLabel = (user.role ?? 'ADMIN').toUpperCase();
  }
}
