import { CommonModule } from '@angular/common';
import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink, Router } from '@angular/router';
import { combineLatest } from 'rxjs';

import { Affectation, AffectationService, Collaborateur, CollaborateurService } from '../../../services/manager';

interface ChargeCard {
  id: number;
  nom: string;
  initiales: string;
  disponible: boolean;
  charge: number;
  projetsCount: number;
  competences: string[];
}

@Component({
  selector: 'app-charge-travail',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './charge-travail.component.html',
  styleUrl: './charge-travail.component.scss'
})
export class ManagerChargeTravailComponent implements OnInit {
  currentDate = new Date();
  searchTerm = '';
  availabilityFilter: 'all' | 'available' | 'busy' = 'all';
  chargeFilter: 'all' | 'ok' | 'warn' | 'over' = 'all';

  collaborateurs: ChargeCard[] = [];
  isLoading = true;
  errorMessage = '';

  constructor(
    private readonly collaborateurService: CollaborateurService,
    private readonly affectationService: AffectationService,
    private readonly router: Router,
    private cdr: ChangeDetectorRef
  ) {}

  get overloadCount(): number {
    return this.collaborateurs.filter((item) => item.charge > 90).length;
  }

  get availabilityCount(): number {
    return this.collaborateurs.filter((item) => item.disponible).length;
  }

  get engagedCount(): number {
    return this.collaborateurs.filter((item) => !item.disponible).length;
  }

  get averageCharge(): number {
    if (!this.collaborateurs.length) return 0;
    const total = this.collaborateurs.reduce((sum, item) => sum + item.charge, 0);
    return Math.round(total / this.collaborateurs.length);
  }

  get activeProjectsCount(): number {
    return this.collaborateurs.reduce((sum, item) => sum + item.projetsCount, 0);
  }

  get filteredCollaborateurs(): ChargeCard[] {
    const search = this.searchTerm.trim().toLowerCase();

    return this.collaborateurs.filter((item) => {
      const matchesSearch = !search || [
        item.nom,
        ...item.competences,
      ].some((value) => value.toLowerCase().includes(search));

      const matchesAvailability =
        this.availabilityFilter === 'all' ||
        (this.availabilityFilter === 'available' && item.disponible) ||
        (this.availabilityFilter === 'busy' && !item.disponible);

      const tone = this.chargeTone(item.charge);
      const matchesCharge = this.chargeFilter === 'all' || tone === this.chargeFilter;

      return matchesSearch && matchesAvailability && matchesCharge;
    });
  }

  ngOnInit(): void {
    combineLatest([
      this.collaborateurService.getAll(),
      this.affectationService.getAll()
    ]).subscribe({
      next: ([collaborateurs, affectations]) => {
        try {
          this.collaborateurs = this.buildCards(collaborateurs, affectations);
        } catch {
          this.errorMessage = 'Erreur traitement données.';
        } finally {
          this.isLoading = false;

          // 🔥 FIX PRINCIPAL (supprime le blocage)
          this.cdr.detectChanges();
        }
      },
      error: () => {
        this.errorMessage = 'Impossible de charger la charge de travail des collaborateurs.';
        this.isLoading = false;

        // 🔥 IMPORTANT aussi ici
        this.cdr.detectChanges();
      }
    });
  }

  trackByCollaborateur(_: number, collaborateur: ChargeCard): number {
    return collaborateur.id;
  }

  clearFilters(): void {
    this.searchTerm = '';
    this.availabilityFilter = 'all';
    this.chargeFilter = 'all';
  }

  refreshData(): void {
    this.isLoading = true;
    this.errorMessage = '';
    this.ngOnInit();
  }

  chargeTone(charge: number): 'ok' | 'warn' | 'over' {
    if (charge > 90) return 'over';
    if (charge > 70) return 'warn';
    return 'ok';
  }

  // ── Design v2 helpers ────────────────────────────────

  chargeColor(charge: number): string {
    if (charge >= 90) return '#ef4444';
    if (charge > 40)  return '#f59e0b';
    return '#10b981';
  }

  private readonly _avPalette: Record<string, string> = {
    a: '#3b82f6', b: '#3b82f6', c: '#3b82f6',
    d: '#10b981', e: '#10b981', f: '#10b981',
    g: '#8b5cf6', h: '#8b5cf6', i: '#8b5cf6',
    j: '#f59e0b', k: '#f59e0b', l: '#f59e0b',
    m: '#8b5cf6', n: '#ef4444', o: '#ef4444',
    p: '#ef4444', q: '#06b6d4', r: '#06b6d4',
    s: '#06b6d4', t: '#f59e0b', u: '#10b981',
    v: '#10b981', w: '#3b82f6', x: '#8b5cf6',
    y: '#ef4444', z: '#f59e0b',
  };

  avatarColor(nom: string): string {
    const first = (nom?.[0] ?? 'a').toLowerCase();
    return this._avPalette[first] ?? '#64748b';
  }

  logout(): void {
    this.router.navigate(['/login']);
  }

  private buildCards(collaborateurs: Collaborateur[], affectations: Affectation[]): ChargeCard[] {
    return collaborateurs.map((collaborateur) => {

      const active = affectations.filter(
        (affectation) =>
          affectation.collaborateur.id === collaborateur.id &&
          affectation.projet.statut !== 'termine'
      );

      const charge = Math.min(100, active.length * 35 + (collaborateur.disponible ? 10 : 30));

      const fullName = `${collaborateur.prenom} ${collaborateur.nom}`.trim();

      return {
        id: collaborateur.id ?? 0,
        nom: fullName,
        initiales: fullName
          .split(' ')
          .map((p) => p[0] ?? '')
          .join('')
          .slice(0, 2)
          .toUpperCase(),
        disponible: collaborateur.disponible,
        charge,
        projetsCount: active.length,
        competences: (collaborateur.competences ?? [])
          .map((c) => c.nom)
          .slice(0, 4)
      };
    }).sort((a, b) => b.charge - a.charge);
  }
}