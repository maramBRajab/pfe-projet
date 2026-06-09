import { CommonModule, DatePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectorRef, Component, OnDestroy, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';

import { AdminNotificationsService, AdminNotificationItem, AdminNotificationsStats } from '../../../services/admin/notifications.service';
import { NotificationBadgeService } from '../../../services/admin/notification-badge.service';
import { AuthService } from '../../../services/auth';
import { AdminSidebarComponent } from '../shared/admin-sidebar.component';
import { AdminTopbarComponent } from '../shared/admin-topbar.component';
import { AdminNotificationsPanelService } from '../shared/admin-notifications-panel.service';

import { KpiCardComponent } from '../../../shared/kpi-card/kpi-card.component';
@Component({
  selector: 'app-admin-notifications-page',
  standalone: true,
  imports: [CommonModule, DatePipe, FormsModule, KpiCardComponent, AdminSidebarComponent, AdminTopbarComponent],
  templateUrl: './notifications-page.component.html',
  styleUrl: './notifications-page.component.scss'
})
export class AdminNotificationsPageComponent implements OnInit, OnDestroy {
  currentDate = new Date();
  lastUpdated = new Date();
  notifications: AdminNotificationItem[] = [];
  stats: AdminNotificationsStats = { total: 0, vigilances: 0, critiques: 0, informations: 0, nonLues: 0 };
  activeFilter: 'all' | 'CRITIQUE' | 'VIGILANCE' | 'INFO' = 'all';
  adminPhoto: string | null = null;
  searchQuery = '';
  loading = false;
  error = false;
  deleteModalOpen = false;
  notifToDelete: AdminNotificationItem | null = null;
  isDeleting = false;
  toast = { visible: false, type: 'success' as 'success' | 'error', message: '' };

  private badgeSubscription?: Subscription;
  private toastTimer?: ReturnType<typeof setTimeout>;
  private destroyed = false;
  topbarUnreadCount = 0;

  constructor(
    private readonly notificationsService: AdminNotificationsService,
    private readonly notificationsPanel: AdminNotificationsPanelService,
    private readonly router: Router,
    private readonly notificationBadgeService: NotificationBadgeService,
    private readonly authService: AuthService,
    private readonly changeDetectorRef: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    if (!this.authService.isLoggedIn) {
      void this.router.navigate(['/login']);
      return;
    }

    this.adminPhoto = this.authService.currentUser?.photoUrl ?? null;
    this.notificationsPanel.close();
    this.notificationBadgeService.reset();
    this.topbarUnreadCount = 0;
    this.badgeSubscription = this.notificationBadgeService.count$.subscribe((count) => {
      this.topbarUnreadCount = count;
    });
    this.loadNotifications();
  }

  ngOnDestroy(): void {
    this.destroyed = true;
    this.badgeSubscription?.unsubscribe();
    if (this.toastTimer) {
      clearTimeout(this.toastTimer);
    }
  }

  get infoCount(): number {
    return this.stats.informations;
  }

  get warningCount(): number {
    return this.stats.vigilances;
  }

  get dangerCount(): number {
    return this.stats.critiques;
  }

  get unreadCount(): number {
    return this.stats.nonLues;
  }

  get todayCount(): number {
    const today = new Date();
    return this.notifications.filter((notification) => {
      const parsedDate = this.parseDate(notification);
      return parsedDate.getDate() === today.getDate()
        && parsedDate.getMonth() === today.getMonth()
        && parsedDate.getFullYear() === today.getFullYear();
    }).length;
  }

  get criticalRate(): number {
    if (!this.notifications.length) {
      return 0;
    }

    return Math.round((this.dangerCount / this.notifications.length) * 100);
  }

  get activeTypesCount(): number {
    return new Set(
      this.notifications.map((notification) => notification.type?.trim()).filter((type): type is string => !!type)
    ).size;
  }

  get totalCount(): number {
    return this.stats.total;
  }

  get latestAlertLabel(): string {
    const latest = this.getLatestNotification();
    if (!latest) {
      return 'Aucune';
    }

    return this.notificationLabel(latest);
  }

  get filteredNotifications(): AdminNotificationItem[] {
    let list = this.notifications;
    if (this.activeFilter !== 'all') {
      list = list.filter((notification) => (notification.type ?? '').toUpperCase() === this.activeFilter);
    }

    const query = this.searchQuery.trim().toLowerCase();
    if (query) {
      list = list.filter((notification) => {
        return (notification.titre ?? '').toLowerCase().includes(query)
          || (notification.description ?? '').toLowerCase().includes(query)
          || (notification.projetNom ?? '').toLowerCase().includes(query)
          || (notification.type ?? '').toLowerCase().includes(query);
      });
    }

    return list;
  }

  loadNotifications(): void {
    this.loading = true;
    this.error = false;

    this.notificationsService.getAll().subscribe({
      next: (data) => {
        this.notifications = (data?.notifications ?? []).sort((left, right) => this.parseDate(right).getTime() - this.parseDate(left).getTime());
        this.stats = data?.stats ?? { total: 0, vigilances: 0, critiques: 0, informations: 0, nonLues: 0 };
        this.lastUpdated = new Date();
        this.topbarUnreadCount = this.stats.nonLues;
        this.loading = false;
        this.notificationBadgeService.load();
        this.syncView();
      },
      error: (error: unknown) => {
        if (error instanceof HttpErrorResponse && (error.status === 401 || error.status === 403)) {
          this.loading = false;
          this.syncView();
          void this.router.navigate(['/login']);
          return;
        }

        this.error = true;
        this.loading = false;
        this.syncView();
      }
    });
  }

  setFilter(filter: 'all' | 'CRITIQUE' | 'VIGILANCE' | 'INFO'): void {
    this.activeFilter = filter;
  }

  clearSearch(): void {
    this.searchQuery = '';
  }

  openDeleteModal(notification: AdminNotificationItem): void {
    this.notifToDelete = notification;
    this.deleteModalOpen = true;
  }

  closeDeleteModal(): void {
    if (this.isDeleting) {
      return;
    }

    this.deleteModalOpen = false;
    this.notifToDelete = null;
  }

  onModalBackdropClick(): void {
    this.closeDeleteModal();
  }

  confirmDelete(): void {
    if (!this.notifToDelete || this.notifToDelete.id == null || this.isDeleting) {
      return;
    }

    const target = this.notifToDelete;
    this.isDeleting = true;

    this.notificationsService.delete(target.id).subscribe({
      next: () => {
        const wasUnread = !this.isRead(target);
        this.notifications = this.notifications.filter((notification) => notification.id !== target.id);
        this.recomputeStats();
        this.isDeleting = false;
        this.closeDeleteModal();
        if (wasUnread) {
          this.notificationBadgeService.decrement(1);
        }
        this.showToast('Notification supprimée');
        this.syncView();
      },
      error: () => {
        this.isDeleting = false;
        this.showToast('Erreur lors de la suppression', 'error');
        this.syncView();
      }
    });
  }

  markAllRead(): void {
    this.notificationsService.markAllAsRead().subscribe({
      next: () => {
        this.notifications = this.notifications.map((notification) => ({ ...notification, isRead: true }));
        this.recomputeStats();
        this.notificationBadgeService.reset();
        this.showToast('Toutes les notifications marquées comme lues');
        this.syncView();
      },
      error: () => {
        this.showToast('Erreur lors de la mise à jour', 'error');
        this.syncView();
      }
    });
  }

  markRead(notification: AdminNotificationItem): void {
    if (notification.isRead || notification.id == null) {
      return;
    }

    this.notificationsService.markAsRead(notification.id).subscribe({
      next: () => {
        notification.isRead = true;
        this.recomputeStats();
        this.notificationBadgeService.decrement(1);
        this.syncView();
      },
      error: () => {
        this.showToast('Erreur lors du marquage', 'error');
        this.syncView();
      }
    });
  }

  isRead(notification: AdminNotificationItem): boolean {
    return !!notification.isRead;
  }

  isProjectNotification(notification: AdminNotificationItem): boolean {
    if (notification.projetId != null) {
      return true;
    }

    const text = `${notification.titre ?? ''} ${notification.description ?? ''}`.toLowerCase();
    return text.includes('projet');
  }

  isUserNotification(notification: AdminNotificationItem): boolean {
    const text = `${notification.titre ?? ''} ${notification.description ?? ''}`.toLowerCase();
    return text.includes('utilisateur')
      || text.includes('compte')
      || text.includes('email vérifié')
      || text.includes('adresse email vérifiée');
  }

  voirUtilisateur(notification: AdminNotificationItem): void {
    if (!this.isUserNotification(notification)) {
      return;
    }
    this.router.navigate(['/admin/collaborateurs']);
  }

  voirProjet(notification?: AdminNotificationItem): void {
    if (notification && !this.isProjectNotification(notification)) {
      return;
    }
    this.router.navigate(['/admin/projets']);
  }

  exporterCSV(): void {
    const headers = ['Titre', 'Date', 'Niveau', 'Message'];
    const rows = this.filteredNotifications.map((notification) => [
      `"${(notification.titre ?? '').replace(/"/g, '""')}"`,
      notification.createdAt,
      this.notificationLabel(notification),
      `"${(notification.description ?? '').replace(/"/g, '""')}"`
    ]);
    const csv = [headers, ...rows].map((row) => row.join(';')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'notifications.csv';
    anchor.click();
    URL.revokeObjectURL(url);
  }

  exporterPDF(): void {
    window.print();
  }

  trackByNotification(_: number, notification: AdminNotificationItem): number {
    return notification.id;
  }

  notificationTone(notification: AdminNotificationItem): 'info' | 'warning' | 'danger' {
    const type = (notification.type ?? '').toUpperCase();
    if (type === 'CRITIQUE') {
      return 'danger';
    }
    if (type === 'VIGILANCE') {
      return 'warning';
    }
    return 'info';
  }

  notificationLabel(notification: AdminNotificationItem): string {
    switch (this.notificationTone(notification)) {
      case 'danger':
        return 'Critique';
      case 'warning':
        return 'Vigilance';
      default:
        return 'Information';
    }
  }

  showToast(message: string, type: 'success' | 'error' = 'success'): void {
    if (this.toastTimer) {
      clearTimeout(this.toastTimer);
    }

    this.toast = { visible: true, type, message };
    this.toastTimer = setTimeout(() => {
      this.toast.visible = false;
      this.syncView();
    }, 2500);
    this.syncView();
  }

  dismissToast(): void {
    if (this.toastTimer) {
      clearTimeout(this.toastTimer);
    }

    this.toast.visible = false;
  }

  private getLatestNotification(): AdminNotificationItem | null {
    if (!this.notifications.length) {
      return null;
    }

    return this.notifications.reduce<AdminNotificationItem | null>((latest, notification) => {
      if (!latest) {
        return notification;
      }

      return this.parseDate(notification).getTime() > this.parseDate(latest).getTime() ? notification : latest;
    }, null);
  }

  private parseDate(notification: AdminNotificationItem): Date {
    const parsed = new Date(notification.createdAt);
    return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
  }

  private recomputeStats(): void {
    const total = this.notifications.length;
    const critiques = this.notifications.filter((notification) => (notification.type ?? '').toUpperCase() === 'CRITIQUE').length;
    const vigilances = this.notifications.filter((notification) => (notification.type ?? '').toUpperCase() === 'VIGILANCE').length;
    const informations = this.notifications.filter((notification) => (notification.type ?? '').toUpperCase() === 'INFO').length;
    const nonLues = this.notifications.filter((notification) => !notification.isRead).length;

    this.stats = { total, critiques, vigilances, informations, nonLues };
    this.topbarUnreadCount = nonLues;
  }

  private syncView(): void {
    if (this.destroyed) {
      return;
    }

    this.changeDetectorRef.detectChanges();
  }
}
