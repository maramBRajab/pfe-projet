import { CommonModule, DatePipe } from '@angular/common';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';

import { Notification } from '../../../shared/models/notification.model';
import { NotificationService } from '../../../services/manager';
import { AdminSidebarComponent } from '../shared/admin-sidebar.component';
import { AdminNotificationsPanelService } from '../shared/admin-notifications-panel.service';
import { ManagerNotificationApiService } from '../../../services/manager';

@Component({
  selector: 'app-admin-notifications-page',
  standalone: true,
  imports: [CommonModule, DatePipe, FormsModule, AdminSidebarComponent],
  templateUrl: './notifications-page.component.html',
  styleUrl: './notifications-page.component.scss'
})
export class AdminNotificationsPageComponent implements OnInit, OnDestroy {
  currentDate = new Date();
  lastUpdated = new Date();
  notifications: Notification[] = [];
  activeFilter: 'all' | 'danger' | 'warning' | 'info' = 'all';
  readIds = new Set<string>();
  adminPhoto: string | null = null;
  searchQuery = '';
  confirmDeleteId: string | null = null;

  private subscription?: Subscription;

  constructor(
    private readonly notificationService: NotificationService,
    private readonly notificationsPanel: AdminNotificationsPanelService,
    private readonly router: Router,
    private readonly api: ManagerNotificationApiService
  ) {}

  ngOnInit(): void {
    this.adminPhoto = localStorage.getItem('smartassign_admin_photo');
    this.notificationsPanel.close();
    this.refreshNotifications();
    this.subscription = this.notificationService.notifications$.subscribe((notification) => {
      const n: Notification = {
        titre: (notification as any).titre ?? '',
        message: (notification as any).description ?? (notification as any).message ?? '',
        type: (notification as any).type ?? '',
        niveau: this.mapTypeToNiveau((notification as any).type),
        dateCreation: (notification as any).temps ?? new Date().toISOString()
      };
      const exists = this.notifications.some(x => x.titre === n.titre && x.dateCreation === n.dateCreation);
      if (!exists) {
        this.notifications = [n, ...this.notifications];
        this.lastUpdated = new Date();
      }
    });
  }

  ngOnDestroy(): void {
    this.subscription?.unsubscribe();
  }

  get infoCount(): number {
    return this.notifications.filter(n => this.notificationTone(n) === 'info').length;
  }

  get warningCount(): number {
    return this.notifications.filter(n => this.notificationTone(n) === 'warning').length;
  }

  get dangerCount(): number {
    return this.notifications.filter(n => this.notificationTone(n) === 'danger').length;
  }

  get unreadCount(): number {
    return this.notifications.filter(n => !this.isRead(n)).length;
  }

  get todayCount(): number {
    const today = new Date();
    return this.notifications.filter(n => {
      const d = this.parseDate(n);
      return d.getDate() === today.getDate()
        && d.getMonth() === today.getMonth()
        && d.getFullYear() === today.getFullYear();
    }).length;
  }

  get criticalRate(): number {
    if (!this.notifications.length) return 0;
    return Math.round((this.dangerCount / this.notifications.length) * 100);
  }

  get activeTypesCount(): number {
    return new Set(
      this.notifications.map(n => n.type?.trim()).filter((t): t is string => !!t)
    ).size;
  }

  get latestAlertLabel(): string {
    const latest = this.getLatestNotification();
    if (!latest) return 'Aucune';
    return this.notificationLabel(latest);
  }

  get filteredNotifications(): Notification[] {
    let list = this.notifications;
    if (this.activeFilter !== 'all') {
      list = list.filter(n => this.notificationTone(n) === this.activeFilter);
    }
    const q = this.searchQuery.trim().toLowerCase();
    if (q) {
      list = list.filter(n =>
        (n.titre ?? '').toLowerCase().includes(q) ||
        (n.message ?? '').toLowerCase().includes(q) ||
        (n.type ?? '').toLowerCase().includes(q)
      );
    }
    return list;
  }

  refreshNotifications(): void {
    this.api.list().subscribe({
      next: (data) => {
        this.notifications = (data ?? []).map(item => ({
          titre: item.titre ?? '',
          message: item.description ?? '',
          type: item.type ?? '',
          niveau: this.mapTypeToNiveau(item.type),
          dateCreation: item.temps ?? new Date().toISOString()
        } as Notification));
        this.lastUpdated = new Date();
      },
      error: (err) => console.error('Erreur:', err)
    });
  }

  setFilter(f: 'all' | 'danger' | 'warning' | 'info'): void {
    this.activeFilter = f;
  }

  clearSearch(): void {
    this.searchQuery = '';
  }

  askDelete(n: Notification): void {
    this.confirmDeleteId = this.notifId(n);
  }

  confirmDelete(n: Notification): void {
    this.notifications = this.notifications.filter(x => this.notifId(x) !== this.notifId(n));
    this.confirmDeleteId = null;
  }

  cancelDelete(): void {
    this.confirmDeleteId = null;
  }

  markAllRead(): void {
    this.notifications.forEach(n => this.readIds.add(this.notifId(n)));
  }

  markRead(n: Notification): void {
    this.readIds.add(this.notifId(n));
  }

  isRead(n: Notification): boolean {
    return this.readIds.has(this.notifId(n));
  }

  voirDetails(n: Notification): void {
    const type = (n.type ?? '').toUpperCase();
    if (type === 'SECURITE')                               this.router.navigate(['/admin/audit']);
    else if (type === 'UTILISATEUR')                       this.router.navigate(['/admin/collaborateurs']);
    else if (type === 'AFFECTATION' || type === 'PROJET')  this.router.navigate(['/admin/rapports']);
    else if (type === 'SYSTEME')                           this.router.navigate(['/admin/parametres']);
    else                                                   this.router.navigate(['/admin/dashboard']);
  }

  exporterCSV(): void {
    const headers = ['Titre', 'Date', 'Niveau', 'Message'];
    const rows = this.filteredNotifications.map(n => [
      `"${(n.titre ?? '').replace(/"/g, '""')}"`,
      n.dateCreation,
      n.niveau,
      `"${(n.message ?? '').replace(/"/g, '""')}"`
    ]);
    const csv = [headers, ...rows].map(r => r.join(';')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'notifications.csv'; a.click();
    URL.revokeObjectURL(url);
  }

  exporterPDF(): void { window.print(); }

  private mapTypeToNiveau(type: string): string {
    switch (type) {
      case 'CRITIQUE': return 'danger';
      case 'VIGILANCE': return 'warning';
      default: return 'info';
    }
  }

  notificationTone(n: Notification): 'info' | 'warning' | 'danger' {
    const niv = (n.niveau ?? '').toLowerCase();
    if (niv.includes('danger') || niv.includes('crit')) return 'danger';
    if (niv.includes('warn') || niv.includes('warning') || niv.includes('attention')) return 'warning';
    return 'info';
  }

  notificationLabel(n: Notification): string {
    switch (this.notificationTone(n)) {
      case 'danger':  return 'Critique';
      case 'warning': return 'Vigilance';
      default:        return 'Information';
    }
  }

  trackByNotification(index: number, n: Notification): string {
    return `${n.type}-${n.dateCreation}-${index}`;
  }

  notifId(n: Notification): string {
    return `${n.type}-${n.dateCreation}`;
  }

  private getLatestNotification(): Notification | null {
    if (!this.notifications.length) return null;
    return this.notifications.reduce<Notification | null>((latest, n) => {
      if (!latest) return n;
      return this.parseDate(n).getTime() > this.parseDate(latest).getTime() ? n : latest;
    }, null);
  }

  private parseDate(n: Notification): Date {
    const d = new Date(n.dateCreation);
    return Number.isNaN(d.getTime()) ? new Date() : d;
  }
}