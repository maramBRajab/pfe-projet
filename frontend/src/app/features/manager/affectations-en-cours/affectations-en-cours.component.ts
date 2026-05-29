import { CommonModule, DatePipe } from '@angular/common';
import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';

import { Affectation, AffectationService } from '../../../services/manager';
import { ManagerShellComponent } from '../shared/manager-shell.component';

@Component({
  selector: 'app-affectations-en-cours',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, DatePipe, ManagerShellComponent],
  templateUrl: './affectations-en-cours.component.html',
  styleUrl: './affectations-en-cours.component.scss'
})
export class ManagerAffectationsEnCoursComponent implements OnInit {
  affectations: Affectation[] = [];
  deletingIds = new Set<number>();
  searchTerm = '';
  isLoading = true;
  errorMessage = '';

  constructor(
    private readonly affectationService: AffectationService,
    private readonly cdr: ChangeDetectorRef
  ) {}

  get activeAffectations(): Affectation[] {
    const term = this.searchTerm.trim().toLowerCase();

    return this.affectations.filter((affectation) => {
      const active = affectation.projet.statut !== 'termine';
      const matches = !term
        || affectation.projet.nom.toLowerCase().includes(term)
        || affectation.collaborateur.nom.toLowerCase().includes(term)
        || affectation.collaborateur.prenom.toLowerCase().includes(term);

      return active && matches;
    });
  }

  get averageScore(): number {
    if (!this.activeAffectations.length) {
      return 0;
    }

    return Math.round(this.activeAffectations.reduce((sum, item) => sum + item.score, 0) / this.activeAffectations.length);
  }

  ngOnInit(): void {
    this.charger();
  }

  charger(): void {
    this.isLoading = true;
    this.errorMessage = '';
    this.affectationService.getAll().subscribe({
      next: (affectations) => {
        this.affectations = affectations;
        this.isLoading = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.errorMessage = 'Impossible de charger le suivi des affectations en cours.';
        this.isLoading = false;
        this.cdr.detectChanges();
      }
    });
  }

  supprimerAffectation(id: number): void {
    if (this.deletingIds.has(id)) {
      return;
    }

    if (!confirm('Confirmer l\'annulation de cette affectation ?')) {
      return;
    }

    const previousAffectations = this.affectations;
    this.deletingIds.add(id);
    this.errorMessage = '';
    this.affectations = this.affectations.filter((affectation) => affectation.id !== id);

    this.affectationService.delete(id).subscribe({
      next: () => {
        this.deletingIds.delete(id);
        this.cdr.detectChanges();
      },
      error: () => {
        this.deletingIds.delete(id);
        this.affectations = previousAffectations;
        this.errorMessage = `Impossible d'annuler cette affectation.`;
        this.cdr.detectChanges();
      }
    });
  }

  trackByAffectation(_: number, affectation: Affectation): number {
    return affectation.id;
  }

  initials(affectation: Affectation): string {
    return `${affectation.collaborateur.prenom} ${affectation.collaborateur.nom}`
      .split(' ')
      .map((part) => part[0] ?? '')
      .join('')
      .slice(0, 2)
      .toUpperCase();
  }
}