import { CommonModule } from '@angular/common';
import { Component, ElementRef, HostListener, OnDestroy, OnInit } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';

import { AdminNotificationsPanelService } from './admin-notifications-panel.service';
import { AuthService } from '../../../services/auth';
import { NotificationService } from '../../../services/manager';

@Component({
  selector: 'app-admin-topbar',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <header class="admin-topbar">
      <nav class="admin-topbar__breadcrumb" aria-label="Fil d'Ariane">
        <a routerLink="/admin/dashboard">Admin</a>
        <span class="admin-topbar__sep">/</span>
        <span>Workspace</span>
      </nav>

      <div class="admin-topbar__actions">
        <a class="admin-topbar__icon" routerLink="/admin/dashboard" title="Supervision" aria-label="Supervision">
          <svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <rect x="2" y="2" width="5" height="5" rx="1.2" stroke="currentColor" stroke-width="1.4"></rect>
            <rect x="9" y="2" width="5" height="5" rx="1.2" stroke="currentColor" stroke-width="1.4"></rect>
            <rect x="2" y="9" width="5" height="5" rx="1.2" stroke="currentColor" stroke-width="1.4"></rect>
            <rect x="9" y="9" width="5" height="5" rx="1.2" stroke="currentColor" stroke-width="1.4"></rect>
          </svg>
        </a>

        <button type="button" class="admin-topbar__icon admin-topbar__icon--notif" title="Notifications" aria-label="Notifications" (click)="openNotificationsPanel()">
          <svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path d="M8 2a4 4 0 0 1 4 4c0 4.5 2 5.5 2 5.5H2s2-1 2-5.5a4 4 0 0 1 4-4Z" stroke="currentColor" stroke-width="1.4"></path>
            <path d="M6.5 13.5a1.5 1.5 0 0 0 3 0" stroke="currentColor" stroke-width="1.4"></path>
          </svg>
          <span *ngIf="notificationCount > 0" class="admin-topbar__badge"></span>
        </button>

        <!-- User menu -->
        <div class="admin-topbar__user-wrap">
          <div class="admin-topbar__user-chip" [class.admin-topbar__user-chip--open]="dropdownOpen">
            <div class="admin-topbar__user-av" (click)="navigate('/admin/profil')" style="cursor:pointer" title="Mon profil">AP</div>
            <button
              type="button"
              class="admin-topbar__user-info-btn"
              (click)="toggleDropdown()"
              aria-haspopup="menu"
              [attr.aria-expanded]="dropdownOpen">
              <div class="admin-topbar__user-info">
                <span class="admin-topbar__user-name">Admin Principal</span>
                <span class="admin-topbar__user-role">Administrateur</span>
              </div>
              <svg class="admin-topbar__chevron" [class.admin-topbar__chevron--open]="dropdownOpen" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <path d="M4 6l4 4 4-4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </button>
          </div>

          <div *ngIf="dropdownOpen" class="admin-topbar__dropdown" role="menu">
            <!-- Header (non-clickable) -->
            <div class="admin-topbar__dd-hdr">
              <div class="admin-topbar__dd-av">AP</div>
              <div class="admin-topbar__dd-meta">
                <span class="admin-topbar__dd-name">Admin Principal</span>
                <span class="admin-topbar__dd-email">admin&#64;smartassign.tn</span>
              </div>
            </div>
            <div class="admin-topbar__dd-sep"></div>

            <button type="button" class="admin-topbar__dd-item" role="menuitem" (click)="navigate('/admin/profil')">
              <svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <circle cx="8" cy="5.5" r="2.5" stroke="currentColor" stroke-width="1.4"/>
                <path d="M2.5 13.5c0-3.038 2.462-5.5 5.5-5.5s5.5 2.462 5.5 5.5" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>
              </svg>
              Mon profil
            </button>

            <button type="button" class="admin-topbar__dd-item" role="menuitem" (click)="navigate('/admin/parametres')">
              <svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <circle cx="8" cy="8" r="2" stroke="currentColor" stroke-width="1.4"/>
                <path d="M8 2v1M8 13v1M2 8h1M13 8h1M3.5 3.5l.7.7M11.8 11.8l.7.7M3.5 12.5l.7-.7M11.8 4.2l.7-.7" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>
              </svg>
              Paramètres
            </button>

            <button type="button" class="admin-topbar__dd-item" role="menuitem" (click)="navigate('/admin/notifications')">
              <svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <path d="M8 2a4 4 0 0 1 4 4c0 4.5 2 5.5 2 5.5H2s2-1 2-5.5a4 4 0 0 1 4-4Z" stroke="currentColor" stroke-width="1.4"/>
                <path d="M6.5 13.5a1.5 1.5 0 0 0 3 0" stroke="currentColor" stroke-width="1.4"/>
              </svg>
              Notifications
              <span *ngIf="notificationCount > 0" class="admin-topbar__dd-badge">{{ notificationCount }}</span>
            </button>
          </div>
        </div>
      </div>
    </header>
  `,
  styles: [`
    :host {
      display: block;
      flex-shrink: 0;
    }

    .admin-topbar {
      height: 56px;
      padding: 0 24px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      background: #ffffff;
      border-bottom: 1px solid #e5e9f2;
    }

    .admin-topbar__breadcrumb {
      display: flex;
      align-items: center;
      gap: 6px;
      color: #94a3b8;
      font-size: 12px;
      font-weight: 600;
    }

    .admin-topbar__breadcrumb a {
      color: #64748b;
      text-decoration: none;
    }

    .admin-topbar__sep {
      color: #cbd5e1;
    }

    .admin-topbar__actions {
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .admin-topbar__icon {
      position: relative;
      width: 36px;
      height: 36px;
      border-radius: 10px;
      border: 1px solid #e5e9f2;
      background: #f8fafc;
      color: #64748b;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      text-decoration: none;
      cursor: pointer;
      transition: background .16s ease, border-color .16s ease, transform .16s ease;
      padding: 0;
    }

    .admin-topbar__icon:hover {
      background: #eff6ff;
      border-color: #bfdbfe;
      transform: translateY(-1px);
    }

    .admin-topbar__icon svg {
      width: 15px;
      height: 15px;
      stroke: currentColor;
    }

    .admin-topbar__badge {
      position: absolute;
      top: 6px;
      right: 7px;
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: #dc2626;
      border: 2px solid #fff;
    }

    /* ── User menu wrapper ── */
    .admin-topbar__user-wrap {
      position: relative;
    }

    .admin-topbar__user-chip {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 4px 8px 4px 4px;
      border-radius: 10px;
      border: 1px solid #e5e9f2;
      background: #f8fafc;
      transition: background .16s ease, border-color .16s ease;
    }

    .admin-topbar__user-chip:hover,
    .admin-topbar__user-chip--open {
      background: #eff6ff;
      border-color: #bfdbfe;
    }

    .admin-topbar__user-info-btn {
      display: flex;
      align-items: center;
      gap: 6px;
      background: none;
      border: none;
      cursor: pointer;
      padding: 0;
      font-family: inherit;
    }

    .admin-topbar__user-av {
      width: 28px;
      height: 28px;
      border-radius: 8px;
      background: #2563eb;
      color: #fff;
      font-size: 11px;
      font-weight: 700;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      transition: background .15s;
      &:hover { background: #1d4ed8; }
    }

    .admin-topbar__user-info {
      display: flex;
      flex-direction: column;
      gap: 1px;
    }

    .admin-topbar__user-name {
      font-size: 12px;
      font-weight: 600;
      color: #0f172a;
      line-height: 1.2;
    }

    .admin-topbar__user-role {
      font-size: 10px;
      color: #64748b;
      line-height: 1.2;
    }

    .admin-topbar__chevron {
      width: 14px;
      height: 14px;
      color: #94a3b8;
      flex-shrink: 0;
      transition: transform .18s ease;
    }

    .admin-topbar__chevron--open {
      transform: rotate(180deg);
    }

    /* ── Dropdown ── */
    .admin-topbar__dropdown {
      position: absolute;
      top: calc(100% + 8px);
      right: 0;
      min-width: 224px;
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      box-shadow: 0 8px 24px rgba(0, 0, 0, .10), 0 2px 6px rgba(0, 0, 0, .06);
      z-index: 1000;
      overflow: hidden;
      animation: ddFadeIn .14s ease;
    }

    @keyframes ddFadeIn {
      from { opacity: 0; transform: translateY(-6px); }
      to   { opacity: 1; transform: translateY(0); }
    }

    .admin-topbar__dd-hdr {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 14px 16px;
    }

    .admin-topbar__dd-av {
      width: 32px;
      height: 32px;
      border-radius: 9px;
      background: #2563eb;
      color: #fff;
      font-size: 12px;
      font-weight: 700;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }

    .admin-topbar__dd-meta {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }

    .admin-topbar__dd-name {
      font-size: 13px;
      font-weight: 600;
      color: #0f172a;
      line-height: 1.2;
    }

    .admin-topbar__dd-email {
      font-size: 11px;
      color: #64748b;
      line-height: 1.2;
    }

    .admin-topbar__dd-sep {
      height: 1px;
      background: #f1f5f9;
      margin: 0;
    }

    .admin-topbar__dd-item {
      display: flex;
      align-items: center;
      gap: 10px;
      width: 100%;
      padding: 10px 16px;
      font-size: 13.5px;
      font-weight: 500;
      color: #334155;
      background: transparent;
      border: none;
      cursor: pointer;
      text-align: left;
      transition: background .13s ease, color .13s ease;
    }

    .admin-topbar__dd-item:hover {
      background: #eff6ff;
      color: #1d4ed8;
    }

    .admin-topbar__dd-item svg {
      width: 15px;
      height: 15px;
      flex-shrink: 0;
      stroke: currentColor;
    }

    .admin-topbar__dd-item--danger {
      color: #ef4444;
    }

    .admin-topbar__dd-item--danger:hover {
      background: #fef2f2;
      color: #dc2626;
    }

    .admin-topbar__dd-badge {
      margin-left: auto;
      background: #ef4444;
      color: #fff;
      font-size: 10px;
      font-weight: 700;
      padding: 1px 6px;
      border-radius: 999px;
      line-height: 1.6;
    }
  `]
})
export class AdminTopbarComponent implements OnInit, OnDestroy {
  notificationCount = 0;
  dropdownOpen = false;
  private subscription?: Subscription;

  constructor(
    private readonly notificationsPanel: AdminNotificationsPanelService,
    private readonly authService: AuthService,
    private readonly notificationService: NotificationService,
    private readonly router: Router,
    private readonly elRef: ElementRef
  ) {}

  ngOnInit(): void {
    this.notificationCount = this.notificationService.getSnapshot().length;
    this.subscription = this.notificationService.notifications$.subscribe(() => {
      this.notificationCount = this.notificationService.getSnapshot().length;
    });
  }

  ngOnDestroy(): void {
    this.subscription?.unsubscribe();
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (!this.elRef.nativeElement.contains(event.target)) {
      this.dropdownOpen = false;
    }
  }

  toggleDropdown(): void {
    this.dropdownOpen = !this.dropdownOpen;
  }

  navigate(path: string): void {
    this.dropdownOpen = false;
    void this.router.navigate([path]);
  }

  logout(): void {
    this.dropdownOpen = false;
    this.authService.logout();
    void this.router.navigate(['/login']);
  }

  openNotificationsPanel(): void {
    this.notificationsPanel.open();
  }
}