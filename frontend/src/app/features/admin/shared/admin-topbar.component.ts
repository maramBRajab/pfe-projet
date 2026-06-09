import { CommonModule } from '@angular/common';
import { Component, ElementRef, HostListener, Input } from '@angular/core';
import { Router } from '@angular/router';

import { AdminNotificationItem, AdminNotificationsService } from '../../../services/admin/notifications.service';

@Component({
  selector: 'app-admin-topbar',
  standalone: true,
  imports: [CommonModule],
  template: `
    <header class="admin-topbar">
      <div class="admin-topbar__left">
        <nav class="admin-topbar__breadcrumb" aria-label="Fil d'Ariane">
          {{ breadcrumb }}
        </nav>
      </div>

      <div class="admin-topbar__right">
        <div class="admin-topbar__actions">
          <ng-content select="[topbarActions]"></ng-content>
        </div>

        <div class="admin-topbar__bell-wrap">
          <button
            type="button"
            class="admin-topbar__bell"
            title="Notifications"
            aria-label="Notifications récentes"
            aria-expanded="{{ notificationsMenuOpen }}"
            (click)="toggleNotificationsMenu()">
            <svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path d="M8 2.5a3.5 3.5 0 0 0-3.5 3.5v2L3 10h10l-1.5-2V6A3.5 3.5 0 0 0 8 2.5Z"
                stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/>
              <path d="M6.5 12a1.5 1.5 0 0 0 3 0" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>
            </svg>
            <span class="admin-topbar__badge" *ngIf="notificationCount > 0">{{ notificationCount > 99 ? '99+' : notificationCount }}</span>
          </button>

          <div class="admin-notif-dropdown" *ngIf="notificationsMenuOpen" role="dialog" aria-label="Notifications récentes">
            <div class="admin-notif-dropdown__head">
              <h3>Notifications récentes</h3>
              <span class="admin-notif-dropdown__pill" *ngIf="notificationCount > 0">{{ notificationCount }} non lue(s)</span>
            </div>

            <div class="admin-notif-dropdown__list" *ngIf="!notificationsLoading; else loadingTpl">
              <button
                type="button"
                class="admin-notif-item"
                *ngFor="let notification of recentNotifications"
                (click)="openNotificationsPage()">
                <span class="admin-notif-item__icon" [ngClass]="notificationIconClass(notification)">
                  <svg viewBox="0 0 16 16" fill="none" *ngIf="notificationIconClass(notification) === 'admin-notif-item__icon--user'">
                    <circle cx="8" cy="5.5" r="2.2" stroke="currentColor" stroke-width="1.4"/>
                    <path d="M2.5 13c0-2.3 2.2-3.7 5.5-3.7s5.5 1.4 5.5 3.7" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>
                  </svg>
                  <svg viewBox="0 0 16 16" fill="none" *ngIf="notificationIconClass(notification) === 'admin-notif-item__icon--project'">
                    <rect x="2.5" y="2.5" width="11" height="11" rx="2" stroke="currentColor" stroke-width="1.4"/>
                    <path d="M5 6.5h6M5 9h4" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>
                  </svg>
                  <svg viewBox="0 0 16 16" fill="none" *ngIf="notificationIconClass(notification) === 'admin-notif-item__icon--alert'">
                    <path d="M8 2.5L13.5 12H2.5L8 2.5Z" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/>
                    <path d="M8 6v3" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>
                    <circle cx="8" cy="10.8" r="0.7" fill="currentColor"/>
                  </svg>
                  <svg viewBox="0 0 16 16" fill="none" *ngIf="notificationIconClass(notification) === 'admin-notif-item__icon--info'">
                    <circle cx="8" cy="8" r="5.5" stroke="currentColor" stroke-width="1.4"/>
                    <path d="M8 7v3" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>
                    <circle cx="8" cy="5" r="0.7" fill="currentColor"/>
                  </svg>
                </span>

                <span class="admin-notif-item__body">
                  <span class="admin-notif-item__title">{{ notification.titre }}</span>
                  <span class="admin-notif-item__meta">
                    {{ formatNotificationDate(notification.createdAt) }}
                    <span class="admin-notif-item__state" [class.admin-notif-item__state--read]="notification.isRead">
                      {{ notification.isRead ? 'Lu' : 'Non lu' }}
                    </span>
                  </span>
                </span>
              </button>

              <div class="admin-notif-empty" *ngIf="recentNotifications.length === 0">
                Aucune notification récente.
              </div>
            </div>

            <ng-template #loadingTpl>
              <div class="admin-notif-empty">Chargement des notifications...</div>
            </ng-template>

            <div class="admin-notif-dropdown__footer">
              <button type="button" class="admin-notif-dropdown__all" (click)="openNotificationsPage()">
                Voir toutes les notifications
              </button>
            </div>
          </div>
        </div>

        <button type="button" class="admin-topbar__user" title="Mon profil" aria-label="Mon profil" (click)="openProfile()">
          <span class="admin-topbar__avatar">AP</span>
          <span class="admin-topbar__name">Admin Principal</span>
        </button>
      </div>
    </header>
  `,
  styles: [`
    :host {
      display: block;
      flex-shrink: 0;
    }

    .admin-topbar {
      height: 64px;
      padding: 0 24px;
      background: #fff;
      border-bottom: 1px solid #eee;
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 16px;
    }

    .admin-topbar__left {
      min-width: 0;
      display: flex;
      align-items: center;
    }

    .admin-topbar__breadcrumb {
      font-size: 13px;
      font-weight: 500;
      color: #6b7280;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .admin-topbar__right {
      display: inline-flex;
      align-items: center;
      gap: 14px;
      flex-shrink: 0;
      margin-left: auto;
    }

    .admin-topbar__actions {
      display: inline-flex;
      align-items: center;
      gap: 10px;
    }

    .admin-topbar__bell {
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

    .admin-topbar__bell svg {
      width: 18px;
      height: 18px;
      stroke: currentColor;
    }

    .admin-topbar__bell:hover {
      color: #2563eb;
      border-color: #2563eb;
      background: #f8fbff;
    }

    .admin-topbar__badge {
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

    .admin-topbar__bell-wrap {
      position: relative;
    }

    .admin-notif-dropdown {
      position: absolute;
      top: calc(100% + 10px);
      right: 0;
      width: min(420px, calc(100vw - 24px));
      max-height: 70vh;
      background: #fff;
      border: 1px solid #e5e7eb;
      border-radius: 14px;
      box-shadow: 0 22px 50px rgba(15, 23, 42, 0.18);
      overflow: hidden;
      z-index: 2000;
    }

    .admin-notif-dropdown__head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
      padding: 14px 14px 10px;
      border-bottom: 1px solid #eef2f7;
    }

    .admin-notif-dropdown__head h3 {
      margin: 0;
      font-size: 14px;
      font-weight: 700;
      color: #111827;
    }

    .admin-notif-dropdown__pill {
      font-size: 11px;
      font-weight: 700;
      color: #2563eb;
      background: #eff6ff;
      border: 1px solid #bfdbfe;
      border-radius: 999px;
      padding: 4px 8px;
      white-space: nowrap;
    }

    .admin-notif-dropdown__list {
      max-height: min(48vh, 420px);
      overflow: auto;
      padding: 6px;
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .admin-notif-item {
      width: 100%;
      border: 0;
      background: transparent;
      text-align: left;
      cursor: pointer;
      display: flex;
      align-items: flex-start;
      gap: 10px;
      border-radius: 10px;
      padding: 10px;
      transition: background-color 0.18s ease;
    }

    .admin-notif-item:hover {
      background: #f8fafc;
    }

    .admin-notif-item__icon {
      width: 30px;
      height: 30px;
      border-radius: 9px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      color: #475569;
      background: #f1f5f9;
      border: 1px solid #e2e8f0;
    }

    .admin-notif-item__icon svg {
      width: 15px;
      height: 15px;
    }

    .admin-notif-item__icon--user {
      color: #2563eb;
      background: #eff6ff;
      border-color: #bfdbfe;
    }

    .admin-notif-item__icon--project {
      color: #7c3aed;
      background: #f5f3ff;
      border-color: #ddd6fe;
    }

    .admin-notif-item__icon--alert {
      color: #dc2626;
      background: #fef2f2;
      border-color: #fecaca;
    }

    .admin-notif-item__icon--info {
      color: #0f766e;
      background: #f0fdfa;
      border-color: #99f6e4;
    }

    .admin-notif-item__body {
      min-width: 0;
      display: flex;
      flex-direction: column;
      gap: 3px;
      flex: 1;
    }

    .admin-notif-item__title {
      font-size: 13px;
      font-weight: 600;
      color: #0f172a;
      line-height: 1.25;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .admin-notif-item__meta {
      font-size: 11px;
      color: #64748b;
      display: inline-flex;
      align-items: center;
      gap: 8px;
    }

    .admin-notif-item__state {
      padding: 2px 7px;
      border-radius: 999px;
      font-size: 10px;
      font-weight: 700;
      color: #b91c1c;
      background: #fee2e2;
      border: 1px solid #fecaca;
    }

    .admin-notif-item__state--read {
      color: #0f766e;
      background: #ccfbf1;
      border-color: #99f6e4;
    }

    .admin-notif-empty {
      padding: 16px;
      text-align: center;
      font-size: 12px;
      color: #64748b;
    }

    .admin-notif-dropdown__footer {
      border-top: 1px solid #eef2f7;
      padding: 10px;
      background: #f8fafc;
    }

    .admin-notif-dropdown__all {
      width: 100%;
      border: 1px solid #dbe5f0;
      background: #fff;
      color: #0f172a;
      font-size: 12px;
      font-weight: 700;
      border-radius: 10px;
      padding: 9px 12px;
      cursor: pointer;
      transition: all 0.18s ease;
    }

    .admin-notif-dropdown__all:hover {
      border-color: #2563eb;
      color: #2563eb;
      background: #eff6ff;
    }

    .admin-topbar__user {
      display: inline-flex;
      align-items: center;
      gap: 10px;
      text-decoration: none;
      color: inherit;
      border: 0;
      background: transparent;
      cursor: pointer;
      padding: 0;
    }

    .admin-topbar__avatar {
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

    .admin-topbar__name {
      font-size: 14px;
      font-weight: 600;
      color: #111827;
      white-space: nowrap;
    }
  `]
})
export class AdminTopbarComponent {
  @Input() breadcrumb = 'SmartAssign › Admin';
  @Input() notificationCount = 0;

  notificationsMenuOpen = false;
  notificationsLoading = false;
  recentNotifications: AdminNotificationItem[] = [];

  constructor(
    private readonly notificationsService: AdminNotificationsService,
    private readonly router: Router,
    private readonly elementRef: ElementRef
  ) {}

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (!this.notificationsMenuOpen) {
      return;
    }

    if (!this.elementRef.nativeElement.contains(event.target)) {
      this.notificationsMenuOpen = false;
    }
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.notificationsMenuOpen = false;
  }

  toggleNotificationsMenu(): void {
    this.notificationsMenuOpen = !this.notificationsMenuOpen;
    if (this.notificationsMenuOpen) {
      this.loadRecentNotifications();
    }
  }

  openNotificationsPage(): void {
    this.notificationsMenuOpen = false;
    void this.router.navigate(['/admin/notifications']);
  }

  openProfile(): void {
    void this.router.navigate(['/admin/profil']);
  }

  formatNotificationDate(rawDate: string): string {
    const parsed = new Date(rawDate);
    if (Number.isNaN(parsed.getTime())) {
      return 'Date inconnue';
    }
    return parsed.toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
  }

  notificationIconClass(notification: AdminNotificationItem): 'admin-notif-item__icon--user' | 'admin-notif-item__icon--project' | 'admin-notif-item__icon--alert' | 'admin-notif-item__icon--info' {
    const text = `${notification.titre ?? ''} ${notification.description ?? ''}`.toLowerCase();
    if (text.includes('utilisateur') || text.includes('compte') || text.includes('email')) {
      return 'admin-notif-item__icon--user';
    }

    if (notification.projetId != null || text.includes('projet')) {
      if ((notification.type ?? '').toUpperCase() === 'CRITIQUE') {
        return 'admin-notif-item__icon--alert';
      }
      return 'admin-notif-item__icon--project';
    }

    if ((notification.type ?? '').toUpperCase() === 'CRITIQUE') {
      return 'admin-notif-item__icon--alert';
    }

    return 'admin-notif-item__icon--info';
  }

  private loadRecentNotifications(): void {
    this.notificationsLoading = true;
    this.notificationsService.getAll().subscribe({
      next: (response) => {
        const notifications = response?.notifications ?? [];
        this.recentNotifications = [...notifications]
          .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime())
          .slice(0, 6);
        this.notificationsLoading = false;
      },
      error: () => {
        this.recentNotifications = [];
        this.notificationsLoading = false;
      }
    });
  }
}
