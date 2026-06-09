import { CommonModule, DatePipe } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { RhDashboardService, RhJournal } from '../../../services/collaborateur/rh-dashboard.service';
import { AdminSidebarComponent } from '../shared/admin-sidebar.component';
import { AdminTopbarComponent } from '../shared/admin-topbar.component';

@Component({
  selector: 'app-admin-journal-rh',
  standalone: true,
  imports: [CommonModule, FormsModule, DatePipe, AdminSidebarComponent, AdminTopbarComponent],
  templateUrl: './journal-rh.component.html',
  styleUrl: './journal-rh.component.scss',
})
export class AdminJournalRhComponent implements OnInit {
  loading = false;
  error = '';
  searchQuery = '';
  selectedAction = '';
  journal: RhJournal[] = [];

  readonly rhActionLabels: Record<string, string> = {
    CREATION_UTILISATEUR: 'Création collaborateur',
    CREATE_USER: 'Création collaborateur',
    MODIFICATION_PROFIL: 'Modification profil collaborateur',
    UPDATE_USER: 'Modification profil collaborateur',
    MISE_A_JOUR_PROFIL: 'Modification profil collaborateur',
    CHANGEMENT_DISPONIBILITE: 'Changement disponibilité',
    CHANGEMENT_STATUT: 'Changement disponibilité',
    SUSPENSION: 'Suspension compte',
    ACTIVATION: 'Activation compte',
    GESTION_COMPETENCES: 'Gestion des compétences',
    COMPETENCE_CREATE: 'Gestion des compétences',
    COMPETENCE_UPDATE: 'Gestion des compétences',
    COMPETENCE_DELETE: 'Gestion des compétences',
    CONGE_CREATE: 'Congé',
    CONGE_UPDATE: 'Congé',
    CONGE_DELETE: 'Congé',
    EVALUATION_RH: 'Évaluation RH',
    AJOUT_TACHE: 'Événement RH',
  };

  private readonly technicalActions = new Set([
    'LOGIN',
    'CONNEXION',
    'LOGOUT',
    'DECONNEXION',
    'LOGIN_FAILED',
    'ECHEC_DE_CONNEXION',
    'CHANGE_PASSWORD',
    'CHANGEMENT_DE_MOT_DE_PASSE',
    'RESET_PASSWORD',
    'REINITIALISATION_MOT_DE_PASSE',
    'REINITIALISATION_DU_MOT_DE_PASSE',
    'RESEND_VERIFICATION',
    'RENVOI_EMAIL_VERIFICATION',
    'RENVOI_DE_EMAIL_DE_VERIFICATION',
    'RENVOI_DE_L_EMAIL_DE_VERIFICATION',
    'VERIFY_EMAIL',
    'VERIFICATION_EMAIL',
    'PARAMETRES',
    'GENERATE_TEST_DATA',
    'EXPORT',
    'ASSIGN',
    'UNASSIGN',
    'CREATE_PROJET',
    'UPDATE_PROJET',
    'DELETE_PROJET',
    'ROLE_CHANGE',
    'PERMISSION_CHANGE',
  ]);

  constructor(private readonly rhDashboardService: RhDashboardService) {}

  ngOnInit(): void {
    this.loadJournal();
  }

  get filteredJournal(): RhJournal[] {
    const query = this.searchQuery.trim().toLowerCase();

    return this.journal.filter((entry) => {
      const action = this.normalizeAction(entry.action);

      if (!this.isRhAction(action)) {
        return false;
      }

      if (this.selectedAction && action !== this.selectedAction) {
        return false;
      }

      if (!query) {
        return true;
      }

      return [this.getActionLabel(entry.action), entry.action, entry.utilisateur, entry.details, entry.date]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query));
    });
  }

  get actionOptions(): string[] {
    const actions = new Set(
      this.journal
        .map((entry) => this.normalizeAction(entry.action))
        .filter((action) => this.isRhAction(action))
    );

    return [...actions].sort((a, b) => this.getActionLabel(a).localeCompare(this.getActionLabel(b), 'fr'));
  }

  loadJournal(): void {
    this.loading = true;
    this.error = '';

    this.rhDashboardService.getJournal().subscribe({
      next: (journal) => {
        this.journal = [...journal]
          .filter((entry) => this.isRhAction(this.normalizeAction(entry.action)))
          .sort((a, b) => this.toTimestamp(b.date) - this.toTimestamp(a.date));
        this.loading = false;
      },
      error: () => {
        this.error = 'Impossible de charger le journal RH.';
        this.loading = false;
      },
    });
  }

  trackById(_: number, entry: RhJournal): number {
    return entry.id;
  }

  getActionLabel(action: string): string {
    const normalized = this.normalizeAction(action);
    return this.rhActionLabels[normalized] ?? this.toSentenceCase(action || 'Événement RH');
  }

  private toTimestamp(value: string): number {
    const time = new Date(value).getTime();
    return Number.isFinite(time) ? time : 0;
  }

  private isRhAction(action: string): boolean {
    return !!action && !this.technicalActions.has(action);
  }

  private normalizeAction(action?: string): string {
    return (action ?? '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim()
      .replace(/[\s'-]+/g, '_')
      .toUpperCase();
  }

  private toSentenceCase(value: string): string {
    return value
      .toLowerCase()
      .replace(/_/g, ' ')
      .replace(/^\p{L}/u, (letter) => letter.toUpperCase());
  }
}

