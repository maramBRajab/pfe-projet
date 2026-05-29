import { CommonModule } from '@angular/common';
import { Component, HostListener, OnInit } from '@angular/core';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';

import { AuthService } from '../../../services/auth';
import { AdminNotificationsPanelService } from './admin-notifications-panel.service';

@Component({
  selector: 'app-admin-sidebar',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive],
  templateUrl: './admin-sidebar.component.html',
  styleUrl: './admin-sidebar.component.scss'
})
export class AdminSidebarComponent implements OnInit {

  userInitials    = 'AP';
  userDisplayName = 'Admin Principal';
  userRoleLabel   = 'Administrateur';
  userMenuOpen    = false;

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    const target = event.target as HTMLElement;
    if (!target.closest('.sp-user-block')) {
      this.userMenuOpen = false;
    }
  }

  constructor(
    private readonly authService: AuthService,
    private readonly router: Router,
    readonly notificationsPanel: AdminNotificationsPanelService
  ) {}

  @HostListener('document:keydown.escape')
  onEscapeKey(): void {
    if (this.notificationsPanel.isOpen()) {
      this.notificationsPanel.close();
    }
  }

  ngOnInit(): void {
    const user = this.authService.currentUser;
    if (user) {
      const parts = (user.nom ?? '').trim().split(/\s+/);
      this.userInitials = parts.length >= 2
        ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
        : (user.nom ?? 'A').slice(0, 2).toUpperCase();
      this.userDisplayName = user.nom ?? 'Administrateur';
      this.userRoleLabel   = user.role ?? 'Administrateur';
    }
  }

  logout(): void {
    this.authService.logout();
    void this.router.navigate(['/login']);
  }
}