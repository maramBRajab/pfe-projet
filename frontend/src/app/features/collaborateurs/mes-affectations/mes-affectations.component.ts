import { CommonModule, DatePipe } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { catchError, of, switchMap } from 'rxjs';

import { CollaborateurAffectationDto, CollaborateurService } from '../../../services/collaborateur';
import { AuthService } from '../../../services/auth';
import { CollaborateurShellComponent } from '../shared/collaborateur-shell.component';
import { CollabTopbarComponent } from '../shared/collab-topbar.component';

interface CollaborateurAffectationCard {
  projetNom: string;
  manager: string;
  compatibilite: number;
  progression: number;
  dateAffectation: Date;
  statutProjet: string;
}

@Component({
  selector: 'app-collaborateur-mes-affectations',
  standalone: true,
  imports: [CommonModule, DatePipe, CollaborateurShellComponent, CollabTopbarComponent],
  templateUrl: './mes-affectations.component.html',
  styleUrl: './mes-affectations.component.scss',
})
export class CollaborateurMesAffectationsComponent implements OnInit {
  readonly today = new Date();

  isLoading = true;
  errorMessage = '';
  affectations: CollaborateurAffectationCard[] = [];

  constructor(
    private readonly authService: AuthService,
    private readonly collaborateurService: CollaborateurService
  ) {}

  ngOnInit(): void {
    this.loadAffectations();
  }

  get hasAffectations(): boolean {
    return this.affectations.length > 0;
  }

  statutClass(statutProjet: string): string {
    const normalized = this.normalize(statutProjet);

    if (normalized.includes('termine')) {
      return 'ma-status ma-status--done';
    }

    if (normalized.includes('attente') || normalized.includes('pause')) {
      return 'ma-status ma-status--pending';
    }

    return 'ma-status ma-status--progress';
  }

  statutLabel(statutProjet: string): string {
    const normalized = this.normalize(statutProjet).replace(/\s+/g, '_');

    if (normalized === 'en_cours') {
      return 'En cours';
    }

    if (normalized === 'termine') {
      return 'Terminé';
    }

    return statutProjet;
  }

  compatibiliteClass(score: number): string {
    if (score >= 85) {
      return 'ma-compat ma-compat--high';
    }

    if (score >= 70) {
      return 'ma-compat ma-compat--mid';
    }

    return 'ma-compat ma-compat--low';
  }

  compatibiliteWidth(score: number): string {
    return `${Math.max(0, Math.min(100, score))}%`;
  }

  progressionWidth(value: number): string {
    return `${Math.max(0, Math.min(100, value))}%`;
  }

  private loadAffectations(): void {
    this.isLoading = true;
    this.errorMessage = '';

    const email = this.authService.currentUser?.email?.trim();

    if (!email) {
      this.errorMessage = 'Session collaborateur introuvable.';
      this.isLoading = false;
      return;
    }

    this.collaborateurService.getByEmail(email).pipe(
      switchMap((collaborateur) => {
        if (!collaborateur.id) {
          return of([] as CollaborateurAffectationDto[]);
        }

        return this.collaborateurService.getAffectations(collaborateur.id).pipe(
          catchError(() => of([] as CollaborateurAffectationDto[]))
        );
      }),
      catchError(() => of([] as CollaborateurAffectationDto[]))
    ).subscribe({
      next: (rows) => {
        this.affectations = this.mapAffectations(rows);
        this.isLoading = false;
      },
      error: () => {
        this.errorMessage = 'Impossible de charger les affectations.';
        this.affectations = [];
        this.isLoading = false;
      }
    });
  }

  private mapAffectations(rows: CollaborateurAffectationDto[]): CollaborateurAffectationCard[] {
    return rows.map((item) => ({
      projetNom: item.projet || 'Projet non precise',
      manager: item.manager_nom?.trim() ? item.manager_nom : 'Manager non assigné',
      compatibilite: this.normalizeScore(item.score),
      progression: this.computeProgression(item.statut, item.score),
      dateAffectation: item.date_affectation ? new Date(item.date_affectation) : this.today,
      statutProjet: item.statut || 'En attente',
    }));
  }

  private normalizeScore(rawScore: number): number {
    if (!Number.isFinite(rawScore)) {
      return 0;
    }

    if (rawScore <= 1) {
      return Math.round(rawScore * 100);
    }

    return Math.round(rawScore);
  }

  private computeProgression(statutProjet: string | undefined, score: number): number {
    const normalizedStatus = this.normalize(statutProjet ?? '');

    if (normalizedStatus.includes('termine')) {
      return 100;
    }

    if (normalizedStatus.includes('attente') || normalizedStatus.includes('pause')) {
      return 25;
    }

    const normalizedScore = this.normalizeScore(score);
    return Math.max(35, Math.min(95, normalizedScore - 10));
  }

  private normalize(value: string): string {
    return (value || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim()
      .toLowerCase();
  }
}
