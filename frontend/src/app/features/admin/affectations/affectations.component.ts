import { CommonModule, DatePipe } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';

import { Affectation, AffectationService } from '../../../services/manager';
import { AdminSidebarComponent } from '../shared/admin-sidebar.component';
import { AdminTopbarComponent } from '../shared/admin-topbar.component';

type AffectationRisk = 'Surcharge' | 'Score faible' | 'Indisponible' | 'Projet inactif';
type AffectationFilter = 'all' | 'risk' | 'overload' | 'lowScore' | 'history';

interface AffectationRow {
  affectation: Affectation;
  collaborateurNom: string;
  projetNom: string;
  managerNom: string;
  score: number;
  date: string;
  statut: string;
  active: boolean;
  loadCount: number;
  risks: AffectationRisk[];
}

@Component({
  selector: 'app-admin-affectations',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, DatePipe, AdminSidebarComponent, AdminTopbarComponent],
  templateUrl: './affectations.component.html',
  styleUrl: './affectations.component.scss'
})
export class AdminAffectationsComponent implements OnInit {
  affectations: Affectation[] = [];
  rows: AffectationRow[] = [];
  loading = true;
  error = '';
  searchQuery = '';
  selectedFilter: AffectationFilter = 'all';
  selectedProject = '';

  readonly filters: Array<{ value: AffectationFilter; label: string }> = [
    { value: 'all', label: 'Toutes les affectations' },
    { value: 'risk', label: 'Conflits et alertes' },
    { value: 'overload', label: 'Surcharges' },
    { value: 'lowScore', label: 'Scores faibles' },
    { value: 'history', label: 'Historique' }
  ];

  constructor(private readonly affectationService: AffectationService) {}

  ngOnInit(): void {
    this.loadAffectations();
  }

  loadAffectations(): void {
    this.loading = true;
    this.error = '';

    this.affectationService.getAll().subscribe({
      next: (affectations) => {
        this.affectations = affectations ?? [];
        this.rows = this.buildRows(this.affectations);
        this.loading = false;
      },
      error: () => {
        this.error = 'Impossible de charger le portefeuille global des affectations.';
        this.loading = false;
      }
    });
  }

  get filteredRows(): AffectationRow[] {
    const query = this.searchQuery.trim().toLowerCase();

    return this.rows.filter((row) => {
      const matchesSearch = !query
        || row.collaborateurNom.toLowerCase().includes(query)
        || row.projetNom.toLowerCase().includes(query)
        || row.managerNom.toLowerCase().includes(query);
      const matchesProject = !this.selectedProject || row.projetNom === this.selectedProject;
      const matchesFilter = this.matchesFilter(row);

      return matchesSearch && matchesProject && matchesFilter;
    });
  }

  get projectOptions(): string[] {
    return Array.from(new Set(this.rows.map((row) => row.projetNom))).sort((a, b) => a.localeCompare(b));
  }

  get activeCount(): number {
    return this.rows.filter((row) => row.active).length;
  }

  get averageScore(): number {
    if (!this.rows.length) {
      return 0;
    }

    return Math.round(this.rows.reduce((sum, row) => sum + row.score, 0) / this.rows.length);
  }

  get riskCount(): number {
    return this.rows.filter((row) => row.risks.length > 0).length;
  }

  get overloadedCount(): number {
    return new Set(
      this.rows
        .filter((row) => row.loadCount > 2 && row.active)
        .map((row) => row.affectation.collaborateur.id)
    ).size;
  }

  trackByAffectation(_: number, row: AffectationRow): number {
    return row.affectation.id;
  }

  scoreClass(score: number): string {
    if (score >= 75) {
      return 'score-high';
    }

    if (score >= 50) {
      return 'score-mid';
    }

    return 'score-low';
  }

  resetFilters(): void {
    this.searchQuery = '';
    this.selectedFilter = 'all';
    this.selectedProject = '';
  }

  private buildRows(affectations: Affectation[]): AffectationRow[] {
    const activeLoads = new Map<number, number>();

    affectations.forEach((affectation) => {
      const collaboratorId = affectation.collaborateur.id;
      if (collaboratorId == null || !this.isActiveProject(affectation.projet.statut)) {
        return;
      }

      activeLoads.set(collaboratorId, (activeLoads.get(collaboratorId) ?? 0) + 1);
    });

    return [...affectations]
      .sort((a, b) => new Date(b.dateAffectation).getTime() - new Date(a.dateAffectation).getTime())
      .map((affectation) => {
        const loadCount = activeLoads.get(affectation.collaborateur.id ?? -1) ?? 0;
        const active = this.isActiveProject(affectation.projet.statut);
        const risks = this.resolveRisks(affectation, loadCount, active);

        return {
          affectation,
          collaborateurNom: `${affectation.collaborateur.prenom ?? ''} ${affectation.collaborateur.nom ?? ''}`.trim() || affectation.collaborateur.email,
          projetNom: affectation.projet.nom,
          managerNom: affectation.projet.managerNom || 'Non renseigne',
          score: Math.round(affectation.score ?? 0),
          date: affectation.dateAffectation,
          statut: this.formatStatut(affectation.projet.statut),
          active,
          loadCount,
          risks
        } satisfies AffectationRow;
      });
  }

  private matchesFilter(row: AffectationRow): boolean {
    switch (this.selectedFilter) {
      case 'risk':
        return row.risks.length > 0;
      case 'overload':
        return row.risks.includes('Surcharge');
      case 'lowScore':
        return row.risks.includes('Score faible');
      case 'history':
        return true;
      default:
        return row.active;
    }
  }

  private resolveRisks(affectation: Affectation, loadCount: number, active: boolean): AffectationRisk[] {
    const risks: AffectationRisk[] = [];

    if (loadCount > 2) {
      risks.push('Surcharge');
    }

    if ((affectation.score ?? 0) < 50) {
      risks.push('Score faible');
    }

    if (affectation.collaborateur.disponible === false && active) {
      risks.push('Indisponible');
    }

    if (!active) {
      risks.push('Projet inactif');
    }

    return risks;
  }

  private isActiveProject(statut: string | undefined): boolean {
    const normalized = this.normalize(statut);
    return normalized !== 'termine' && normalized !== 'en_attente' && normalized !== 'en attente';
  }

  private formatStatut(statut: string | undefined): string {
    const normalized = this.normalize(statut);
    const labels: Record<string, string> = {
      en_cours: 'En cours',
      'en cours': 'En cours',
      en_attente: 'En attente',
      'en attente': 'En attente',
      termine: 'Termine',
      suspendu: 'Suspendu',
      retard: 'En retard',
      en_retard: 'En retard'
    };

    return labels[normalized] ?? (statut || 'Non renseigne');
  }

  private normalize(value: string | undefined): string {
    return (value ?? '')
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
  }
}
