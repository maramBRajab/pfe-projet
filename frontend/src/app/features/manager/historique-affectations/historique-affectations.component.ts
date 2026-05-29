import { CommonModule, DatePipe } from '@angular/common';
import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';

import { Affectation, AffectationService } from '../../../services/manager';
import { ManagerShellComponent } from '../shared/manager-shell.component';

@Component({
  selector: 'app-historique-affectations',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, DatePipe, ManagerShellComponent],
  templateUrl: './historique-affectations.component.html',
  styleUrl: './historique-affectations.component.scss'
})
export class ManagerHistoriqueAffectationsComponent implements OnInit {

  affectations: Affectation[] = [];
  searchTerm = '';
  filterProjet = '';
  filterPeriod = 'month';
  isLoading = true;
  errorMessage = '';

  constructor(
    private readonly affectationService: AffectationService,
    private readonly router: Router,
    private readonly cdr: ChangeDetectorRef
  ) {}

  // ── KPIs ──────────────────────────────────────────────────────
  get totalCount(): number { return this.affectations.length; }

  get avgScore(): number {
    if (!this.affectations.length) return 0;
    const sum = this.affectations.reduce((acc, a) => acc + a.score, 0);
    return Math.round(sum / this.affectations.length);
  }

  get thisMonthCount(): number {
    const now = new Date();
    return this.affectations.filter(a => {
      const d = new Date(a.dateAffectation);
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    }).length;
  }

  get bestScore(): number {
    if (!this.affectations.length) return 0;
    return Math.max(...this.affectations.map(a => a.score));
  }

  get bestScoreLabel(): string {
    if (!this.affectations.length) return '—';
    const best = this.affectations.reduce((acc, a) => a.score > acc.score ? a : acc);
    return `${best.collaborateur.prenom} ${best.collaborateur.nom} → ${best.projet.nom}`;
  }

  get projetOptions(): string[] {
    return [...new Set(this.affectations.map(a => a.projet.nom))];
  }

  get filteredAffectations(): Affectation[] {
    const term = this.searchTerm.trim().toLowerCase();
    const now = new Date();
    return this.affectations.filter(a => {
      const bySearch = !term
        || a.projet.nom.toLowerCase().includes(term)
        || a.collaborateur.nom.toLowerCase().includes(term)
        || a.collaborateur.prenom.toLowerCase().includes(term);
      const byProjet = !this.filterProjet || a.projet.nom === this.filterProjet;
      const d = new Date(a.dateAffectation);
      const byPeriod = this.filterPeriod !== 'month'
        || (d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear());
      return bySearch && byProjet && byPeriod;
    });
  }

  // ── Lifecycle ─────────────────────────────────────────────────
  ngOnInit(): void {
    this.affectationService.getAll().subscribe({
       next: (affectations) => {
        this.affectations = [...affectations].sort(
          (a, b) => new Date(b.dateAffectation).getTime() - new Date(a.dateAffectation).getTime()
        );
        this.isLoading = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.errorMessage = `Impossible de charger l'historique des affectations.`;
        this.isLoading = false;
        this.cdr.detectChanges();
      }
    });
  }

  // ── Helpers ───────────────────────────────────────────────────
  getScoreColor(score: number): string {
    if (score >= 75) return '#10b981';
    if (score >= 50) return '#f59e0b';
    return '#ef4444';
  }

  getPotentiel(score: number): string {
    if (score >= 75) return 'Excellent';
    if (score >= 50) return 'À surveiller';
    return 'À confirmer';
  }

  getPotentielClass(score: number): string {
    if (score >= 75) return 'ha-potentiel--green';
    if (score >= 50) return 'ha-potentiel--amber';
    return 'ha-potentiel--red';
  }

  getPotentielIcon(score: number): string {
    if (score >= 75) return 'ti-circle-check';
    if (score >= 50) return 'ti-eye';
    return 'ti-alert-triangle';
  }

  logout(): void { this.router.navigate(['/login']); }

  trackByAffectation(_: number, affectation: Affectation): number {
    return affectation.id;
  }
}
