import { CommonModule } from '@angular/common';
import { Component, Input, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { catchError, of } from 'rxjs';
import { AuthService } from '../../../services/auth';
import { ManagerNotificationApiService } from '../../../services/manager';

@Component({
  selector: 'app-manager-topbar',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <header class="manager-topbar">
      <div class="manager-topbar__left">
        <nav class="manager-topbar__breadcrumb" aria-label="Fil d'Ariane">
          {{ breadcrumb }}
        </nav>
      </div>

      <div class="manager-topbar__right">
        <button
          type="button"
          class="manager-topbar__bell"
          routerLink="/manager/notifications"
          title="Notifications"
          aria-label="Notifications">
          <svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path d="M8 2.5a3.5 3.5 0 0 0-3.5 3.5v2L3 10h10l-1.5-2V6A3.5 3.5 0 0 0 8 2.5Z"
              stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/>
            <path d="M6.5 12a1.5 1.5 0 0 0 3 0" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>
          </svg>
          <span class="manager-topbar__badge" *ngIf="notificationCount > 0">{{ notificationCount }}</span>
        </button>

        <a class="manager-topbar__user" routerLink="/manager/profil" title="Mon profil" aria-label="Mon profil">
          <span class="manager-topbar__avatar">{{ userInitials }}</span>
          <span class="manager-topbar__name">{{ userName }}</span>
        </a>
      </div>
    </header>
  `,
  styles: [`
    :host {
      display: block;
      flex-shrink: 0;
    }

    .manager-topbar {
      height: 64px;
      padding: 0 24px;
      background: #fff;
      border-bottom: 1px solid #eee;
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 16px;
    }

    .manager-topbar__left {
      min-width: 0;
      display: flex;
      align-items: center;
    }

    .manager-topbar__breadcrumb {
      font-size: 13px;
      font-weight: 500;
      color: #6b7280;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .manager-topbar__right {
      display: inline-flex;
      align-items: center;
      gap: 14px;
      flex-shrink: 0;
      margin-left: auto;
    }

    .manager-topbar__bell {
      position: relative;
      width: 40px;
      height: 40px;
      border-radius: 999px;
      border: 1px solid #e5e7eb;
      background: #fff;
      color: #4b5563;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      padding: 0;
      transition: border-color 0.18s ease, color 0.18s ease, background-color 0.18s ease;
    }

    .manager-topbar__bell svg {
      width: 18px;
      height: 18px;
      stroke: currentColor;
    }

    .manager-topbar__bell:hover {
      color: #2563eb;
      border-color: #2563eb;
      background: #f8fbff;
    }

    .manager-topbar__badge {
      position: absolute;
      top: 3px;
      right: 2px;
      min-width: 16px;
      height: 16px;
      border-radius: 999px;
      border: 2px solid #fff;
      background: #dc2626;
      color: #fff;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      font-size: 10px;
      font-weight: 700;
      padding: 0 3px;
      line-height: 1;
    }

    .manager-topbar__user {
      display: inline-flex;
      align-items: center;
      gap: 10px;
      text-decoration: none;
      color: inherit;
    }

    .manager-topbar__avatar {
      width: 36px;
      height: 36px;
      border-radius: 50%;
      background: #c41e3a;
      color: #fff;
      font-size: 12px;
      font-weight: 700;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }

    .manager-topbar__name {
      font-size: 14px;
      font-weight: 600;
      color: #111827;
      white-space: nowrap;
    }
  `]
})
export class ManagerTopbarComponent implements OnInit {
  userName = 'Manager';
  userInitials = 'MA';

  @Input() breadcrumb = 'SmartAssign › Manager';
  @Input() notificationCount = 0;

  constructor(
    private readonly authService: AuthService,
    private readonly notifApi: ManagerNotificationApiService
  ) {}

  ngOnInit(): void {
    this.authService.getCurrentProfile()
      .pipe(catchError(() => of(this.authService.currentUser)))
      .subscribe((user) => {
        const resolvedUserName = user?.nom?.trim() || 'Manager';
        this.userName = resolvedUserName;
        this.userInitials = this.buildInitials(resolvedUserName);
      });

    // Badge: charge le vrai nombre de notifications non lues depuis la BDD
    this.notifApi.countUnread()
      .pipe(catchError(() => of(0)))
      .subscribe(count => {
        this.notificationCount = count;
      });
  }

  private buildInitials(name: string): string {
    const parts = name
      .trim()
      .split(/\s+/)
      .filter((part) => part.length > 0);

    if (!parts.length) {
      return 'MA';
    }

    return parts
      .map((part) => part[0])
      .join('')
      .slice(0, 2)
      .toUpperCase();
  }
}
