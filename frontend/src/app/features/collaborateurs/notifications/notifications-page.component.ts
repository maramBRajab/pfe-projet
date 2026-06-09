import { CommonModule, DatePipe } from '@angular/common';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { Subscription } from 'rxjs';

import {
  CollaborateurNotificationDto,
  CollaborateurService,
} from '../../../services/collaborateur';
import { AuthService } from '../../../services/auth';
import { CollaborateurShellComponent } from '../shared/collaborateur-shell.component';
import { CollabTopbarComponent } from '../shared/collab-topbar.component';

const NOTIFICATION_LABELS: Record<string, string> = {
  MODIFICATION_PROFIL: 'Modification du profil',
  MISE_A_JOUR_PROFIL: 'Mise à jour du profil',
  CONNEXION: 'Connexion réussie',
  DECONNEXION: 'Déconnexion',
  CREATION_COMPTE: 'Création de compte',
  SUPPRESSION_COMPTE: 'Suppression du compte',
  CHANGEMENT_MOT_DE_PASSE: 'Changement de mot de passe',
  ASSIGNATION_ROLE: "Attribution d'un rôle",
};

@Component({
  selector: 'app-collab-notifications-page',
  standalone: true,
  imports: [CommonModule, DatePipe, CollaborateurShellComponent, CollabTopbarComponent],
  templateUrl: './notifications-page.component.html',
  styleUrl: './notifications-page.component.scss',
})
export class CollaborateurNotificationsPageComponent implements OnInit, OnDestroy {
  currentDate = new Date();
  lastUpdated = new Date();
  notifications: CollaborateurNotificationDto[] = [];
  activeFilter: 'all' | 'CRITIQUE' | 'VIGILANCE' | 'INFO' = 'all';
  readIds = new Set<string>();

  totalAlertes = 0;
  informations = 0;
  vigilances = 0;
  critiques = 0;

  private collaborateurId?: number;

  private loadSubscription?: Subscription;
  private actionSubscription?: Subscription;

  constructor(
    private readonly authService: AuthService,
    private readonly collaborateurService: CollaborateurService
  ) {}

  ngOnInit(): void {
    this.initializeAndLoad();
  }

  ngOnDestroy(): void {
    this.loadSubscription?.unsubscribe();
    this.actionSubscription?.unsubscribe();
  }

  // ── Counts ─────────────────────────────────────────────────

  get totalCount(): number { return this.totalAlertes; }

  get infoCount(): number { return this.informations; }

  get warningCount(): number { return this.vigilances; }

  get dangerCount(): number { return this.critiques; }

  get filteredNotifications(): CollaborateurNotificationDto[] {
    if (this.activeFilter === 'all')    return this.notifications;
    return this.notifications.filter(n => n.type === this.activeFilter);
  }

  get headerStatusLabel(): string {
    if (this.dangerCount > 0)  return 'Attention immédiate';
    if (this.warningCount > 0) return 'Surveillance active';
    return 'Flux normal';
  }

  get headerStatusIsGreen(): boolean {
    return this.dangerCount === 0 && this.warningCount === 0;
  }

  // ── Actions ────────────────────────────────────────────────

  refresh(): void {
    this.loadFromApi();
  }

  markAllRead(): void {
    if (!this.collaborateurId) {
      return;
    }

    this.actionSubscription?.unsubscribe();
    this.actionSubscription = this.collaborateurService.markAllNotificationsRead(this.collaborateurId).subscribe({
      next: () => {
        this.notifications.forEach((notification) => this.readIds.add(this.trackId(notification)));
        this.loadFromApi();
      }
    });
  }

  markRead(n: CollaborateurNotificationDto): void {
    if (!this.collaborateurId || !n.notificationKey) {
      return;
    }

    this.actionSubscription?.unsubscribe();
    this.actionSubscription = this.collaborateurService.dismissNotification(this.collaborateurId, n.notificationKey).subscribe({
      next: () => {
        this.readIds.add(this.trackId(n));
        this.loadFromApi();
      }
    });
  }

  isRead(n: CollaborateurNotificationDto): boolean {
    return this.readIds.has(this.trackId(n));
  }

  // ── Helpers ────────────────────────────────────────────────

  tone(n: CollaborateurNotificationDto): 'info' | 'warning' | 'danger' {
    if (n.type === 'CRITIQUE') {
      return 'danger';
    }

    if (n.type === 'VIGILANCE') {
      return 'warning';
    }

    return 'info';
  }

  label(n: CollaborateurNotificationDto): string {
    return this.formatLabel(n.type);
  }

  formatLabel(key: string): string {
    return NOTIFICATION_LABELS[key]
      ?? key.toLowerCase().replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase());
  }

  displayTitle(n: CollaborateurNotificationDto): string {
    const raw = (n.titre ?? '').trim();
    if (!raw) {
      return this.formatLabel(n.type);
    }

    return /^[A-Z0-9_]+$/.test(raw) ? this.formatLabel(raw) : raw;
  }

  iconClass(n: CollaborateurNotificationDto): string {
    switch (this.tone(n)) {
      case 'danger':  return 'ti ti-alert-octagon';
      case 'warning': return 'ti ti-alert-triangle';
      default:        return 'ti ti-info-circle';
    }
  }

  accentColor(n: CollaborateurNotificationDto): string {
    switch (this.tone(n)) {
      case 'danger':  return '#ef4444';
      case 'warning': return '#f59e0b';
      default:        return '#3b82f6';
    }
  }

  bgColor(n: CollaborateurNotificationDto): string {
    switch (this.tone(n)) {
      case 'danger':  return '#fff5f5';
      case 'warning': return '#fffbeb';
      default:        return '#eff6ff';
    }
  }

  borderColor(n: CollaborateurNotificationDto): string {
    switch (this.tone(n)) {
      case 'danger':  return '#fecaca';
      case 'warning': return '#fde68a';
      default:        return '#bfdbfe';
    }
  }

  badgeBg(n: CollaborateurNotificationDto): string {
    switch (this.tone(n)) {
      case 'danger':  return '#fee2e2';
      case 'warning': return '#fef9c3';
      default:        return '#dbeafe';
    }
  }

  badgeColor(n: CollaborateurNotificationDto): string {
    switch (this.tone(n)) {
      case 'danger':  return '#991b1b';
      case 'warning': return '#92400e';
      default:        return '#1e40af';
    }
  }

  parseDate(n: CollaborateurNotificationDto): Date {
    return n.date ? new Date(n.date) : new Date();
  }

  trackId(n: CollaborateurNotificationDto): string {
    return `${n.id ?? ''}-${n.notificationKey ?? ''}-${n.type}-${n.date ?? ''}`;
  }

  trackByNotification = (_index: number, n: CollaborateurNotificationDto): string => {
    return this.trackId(n);
  };

  private initializeAndLoad(): void {
    const email = this.authService.currentUser?.email?.trim();
    if (!email) {
      this.notifications = [];
      this.totalAlertes = 0;
      this.informations = 0;
      this.vigilances = 0;
      this.critiques = 0;
      return;
    }

    this.loadSubscription?.unsubscribe();
    this.loadSubscription = this.collaborateurService.getByEmail(email).subscribe({
      next: (collaborateur) => {
        this.collaborateurId = collaborateur.id;
        this.loadFromApi();
      },
      error: () => {
        this.notifications = [];
        this.totalAlertes = 0;
        this.informations = 0;
        this.vigilances = 0;
        this.critiques = 0;
      }
    });
  }

  private loadFromApi(): void {
    if (!this.collaborateurId) {
      return;
    }

    this.loadSubscription?.unsubscribe();
    this.loadSubscription = this.collaborateurService.getNotifications(this.collaborateurId).subscribe({
      next: (summary) => {
        this.totalAlertes = summary.totalAlertes;
        this.informations = summary.informations;
        this.vigilances = summary.vigilances;
        this.critiques = summary.critiques;
        this.notifications = summary.notifications ?? [];
        this.lastUpdated = new Date();
      },
      error: () => {
        this.totalAlertes = 0;
        this.informations = 0;
        this.vigilances = 0;
        this.critiques = 0;
        this.notifications = [];
        this.lastUpdated = new Date();
      }
    });
  }
}
