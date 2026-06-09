import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../../services/auth';

@Component({
  selector: 'app-collab-topbar',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <header class="collab-topbar">
      <div class="collab-topbar__left">
        <nav class="collab-topbar__breadcrumb" aria-label="Fil d'Ariane">
          {{ breadcrumb }}
        </nav>
      </div>

      <div class="collab-topbar__right">
        <button
          type="button"
          class="collab-topbar__bell"
          routerLink="/notifications"
          title="Notifications"
          aria-label="Notifications">
          <svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path d="M8 2.5a3.5 3.5 0 0 0-3.5 3.5v2L3 10h10l-1.5-2V6A3.5 3.5 0 0 0 8 2.5Z"
              stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/>
            <path d="M6.5 12a1.5 1.5 0 0 0 3 0" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>
          </svg>
          <span class="collab-topbar__badge" *ngIf="notificationCount > 0">{{ notificationCount }}</span>
        </button>

        <a class="collab-topbar__user" routerLink="/mon-profil" title="Mon profil" aria-label="Mon profil">
          <span class="collab-topbar__avatar">{{ displayInitials }}</span>
          <span class="collab-topbar__name">{{ displayUserName }}</span>
        </a>
      </div>
    </header>
  `,
  styles: [`
    :host {
      display: block;
      flex-shrink: 0;
    }

    .collab-topbar {
      height: 64px;
      padding: 0 24px;
      background: #fff;
      border-bottom: 1px solid #eee;
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 16px;
    }

    .collab-topbar__left {
      min-width: 0;
      display: flex;
      align-items: center;
    }

    .collab-topbar__breadcrumb {
      font-size: 13px;
      font-weight: 500;
      color: #6b7280;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .collab-topbar__right {
      display: inline-flex;
      align-items: center;
      gap: 14px;
      flex-shrink: 0;
      margin-left: auto;
    }

    .collab-topbar__bell {
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

    .collab-topbar__bell svg {
      width: 18px;
      height: 18px;
      stroke: currentColor;
    }

    .collab-topbar__bell:hover {
      color: #2563eb;
      border-color: #2563eb;
      background: #f8fbff;
    }

    .collab-topbar__badge {
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

    .collab-topbar__user {
      display: inline-flex;
      align-items: center;
      gap: 10px;
      text-decoration: none;
      color: inherit;
    }

    .collab-topbar__avatar {
      width: 36px;
      height: 36px;
      border-radius: 50%;
      background: linear-gradient(135deg, #ff7a59 0%, #d92d20 100%);
      color: #fff;
      font-size: 12px;
      font-weight: 700;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 8px 16px rgba(217, 45, 32, 0.16);
      flex-shrink: 0;
    }

    .collab-topbar__name {
      font-size: 14px;
      font-weight: 600;
      color: #111827;
      white-space: nowrap;
    }
  `]
})
export class CollabTopbarComponent {
  @Input() breadcrumb = 'SmartAssign › Collaborateur';
  @Input() notificationCount = 0;
  @Input() userName = '';
  @Input() initials = '';

  constructor(private readonly authService: AuthService) {}

  get displayUserName(): string {
    const sessionName = this.authService.currentUser?.nom?.trim();
    if (sessionName) {
      return sessionName;
    }

    const inputName = this.userName?.trim();
    return inputName || 'Collaborateur';
  }

  get displayInitials(): string {
    const sessionName = this.authService.currentUser?.nom?.trim();
    if (sessionName) {
      return sessionName
        .split(' ')
        .filter((part) => part.length > 0)
        .map((part) => part[0])
        .join('')
        .slice(0, 2)
        .toUpperCase();
    }

    const inputInitials = this.initials?.trim();
    if (inputInitials) {
      return inputInitials.slice(0, 2).toUpperCase();
    }

    return 'CL';
  }
}
