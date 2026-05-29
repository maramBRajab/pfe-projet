import { CommonModule, DatePipe } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';

import { Affectation, AffectationService, Projet, ProjetService } from '../../../services/manager';
import { ManagerShellComponent } from '../shared/manager-shell.component';

@Component({
  selector: 'app-detail-projet',
  standalone: true,
  imports: [CommonModule, RouterLink, DatePipe, ManagerShellComponent],
  templateUrl: './detail-projet.component.html',
  styleUrl: './detail-projet.component.scss'
})
export class ManagerDetailProjetComponent implements OnInit {
  projet: Projet | null = null;
  affectations: Affectation[] = [];
  isLoading = true;
  errorMessage = '';

  constructor(
    private readonly route: ActivatedRoute,
    private readonly projetService: ProjetService,
    private readonly affectationService: AffectationService
  ) {}

  get averageScore(): number {
    if (!this.affectations.length) {
      return 0;
    }

    const total = this.affectations.reduce((sum, affectation) => sum + affectation.score, 0);
    return Math.round(total / this.affectations.length);
  }

  get competenceLabels(): string[] {
    return (this.projet?.competencesRequises ?? []).map((competence) => competence.nom);
  }

  ngOnInit(): void {
    const projetId = Number(this.route.snapshot.paramMap.get('id'));

    if (!Number.isFinite(projetId) || projetId <= 0) {
      this.errorMessage = 'Projet introuvable ou identifiant invalide.';
      this.isLoading = false;
      return;
    }

    this.projetService.getById(projetId).subscribe({
      next: (projet) => {
        this.projet = projet;
        this.loadAffectations(projetId);
      },
      error: () => {
        this.errorMessage = 'Impossible de charger le détail de ce projet.';
        this.isLoading = false;
      }
    });
  }

  trackByAffectation(_: number, affectation: Affectation): number {
    return affectation.id;
  }

  statusLabel(statut: string): string {
    const map: Record<string, string> = {
      en_attente: 'En attente',
      en_cours: 'En cours',
      termine: 'Terminé'
    };

    return map[statut] ?? statut;
  }

  initiales(affectation: Affectation): string {
    const fullName = `${affectation.collaborateur.prenom} ${affectation.collaborateur.nom}`.trim();
    return fullName.split(' ').map((part) => part[0] ?? '').join('').slice(0, 2).toUpperCase();
  }

  private loadAffectations(projetId: number): void {
    this.affectationService.getByProjet(projetId).subscribe({
      next: (affectations) => {
        this.affectations = affectations;
        this.isLoading = false;
      },
      error: () => {
        this.errorMessage = 'Impossible de charger les affectations liées à ce projet.';
        this.isLoading = false;
      }
    });
  }
}