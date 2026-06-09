import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, OnDestroy, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { forkJoin } from 'rxjs';
import {
  LucideActivity,
  LucideAlertTriangle,
  LucideFolderOpen,
  LucideUserCheck,
  LucideUsers
} from '@lucide/angular';
import { ManagerShellComponent } from '../shared/manager-shell.component';
import { ManagerTopbarComponent } from '../shared/manager-topbar.component';
import { Affectation, AffectationService, Collaborateur, CollaborateurService } from '../../../services/manager';
import { KpiCardComponent } from '../../../shared/kpi-card/kpi-card.component';

interface ChargeProjet {
  id: number;
  nom: string;
  statut: string;
}

interface ChargeCollaborateur {
  id: number;
  prenom: string;
  nom: string;
  initials: string;
  disponibilite: 'Disponible' | 'Occupé';
  chargeOccupation: number;
  projets: ChargeProjet[];
  avatarColor: string;
}

@Component({
  selector: 'app-charge-travail',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    KpiCardComponent,
    ManagerShellComponent,
    ManagerTopbarComponent
  ],
  templateUrl: './charge-travail.component.html',
  styleUrl: './charge-travail.component.scss'
})
export class ManagerChargeTravailComponent implements OnInit, OnDestroy {
  collaborateurs: ChargeCollaborateur[] = [];

  searchTerm = '';
  filterDisponibilite = '';
  filterCharge = '';
  filteredCollaborateurs: any[] = [];

  isLoading = false;
  errorMessage = '';

  private readonly avatarPalette = [
    '#3b82f6', '#10b981', '#8b5cf6', '#f59e0b',
    '#ef4444', '#06b6d4', '#14b8a6', '#d946ef'
  ];

  readonly usersIcon = LucideUsers;
  readonly userCheckIcon = LucideUserCheck;
  readonly alertTriangleIcon = LucideAlertTriangle;
  readonly activityIcon = LucideActivity;
  readonly folderOpenIcon = LucideFolderOpen;

  constructor(
    private readonly collaborateurService: CollaborateurService,
    private readonly affectationService: AffectationService,
    private readonly cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.loadData();
  }

  ngOnDestroy(): void {}

  get totalCollaborateurs() { return this.collaborateurs?.length || 0; }

  get capaciteLibre() {
    return this.collaborateurs?.filter(c => c.disponibilite === 'Disponible').length || 0;
  }

  get surcharges() {
    return this.collaborateurs?.filter(c => c.chargeOccupation > 90).length || 0;
  }

  get chargeMoyenne() {
    if (!this.collaborateurs?.length) return 0;
    const avg = this.collaborateurs.reduce((s, c) => s + c.chargeOccupation, 0)
      / this.collaborateurs.length;
    return Math.round(avg);
  }

  get engagedCount() {
    return this.collaborateurs?.filter(c => c.projets.length > 0).length || 0;
  }

  get projetsActifs(): number {
    const ids = new Set(this.collaborateurs.flatMap(c => c.projets.map(p => p.id)));
    return ids.size;
  }

  applyFilters() {
    this.filteredCollaborateurs = this.collaborateurs.filter(c => {
      const matchSearch = !this.searchTerm ||
        (c.prenom + ' ' + c.nom).toLowerCase()
          .includes(this.searchTerm.toLowerCase());
      const matchDispo = !this.filterDisponibilite ||
        c.disponibilite === this.filterDisponibilite;
      const matchCharge = !this.filterCharge ||
        (this.filterCharge === 'low' && c.chargeOccupation <= 30) ||
        (this.filterCharge === 'medium' && c.chargeOccupation > 30 && c.chargeOccupation <= 70) ||
        (this.filterCharge === 'high' && c.chargeOccupation > 70);
      return matchSearch && matchDispo && matchCharge;
    });
  }

  resetFilters() {
    this.searchTerm = '';
    this.filterDisponibilite = '';
    this.filterCharge = '';
    this.applyFilters();
  }

  private loadData(): void {
    this.isLoading = true;
    this.errorMessage = '';

    forkJoin({
      collaborateurs: this.collaborateurService.getAll(),
      affectations: this.affectationService.getAll()
    }).subscribe({
      next: ({ collaborateurs, affectations }) => {
        const normalizedCollaborateurs = this.normalizeCollaborateurs(collaborateurs);
        this.collaborateurs = this.buildRows(normalizedCollaborateurs, affectations);
        this.applyFilters();
        this.isLoading = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.errorMessage = 'Impossible de charger la charge de travail des collaborateurs.';
        this.isLoading = false;
        this.cdr.detectChanges();
      }
    });
  }

  private normalizeCollaborateurs(collaborateurs: Collaborateur[]): Collaborateur[] {
    if (!Array.isArray(collaborateurs)) {
      return [];
    }

    return collaborateurs.filter((collaborateur) => this.isCollaborateurRole(collaborateur.role));
  }

  private isCollaborateurRole(role: string | undefined): boolean {
    const normalizedRole = (role ?? 'COLLAB').trim().toUpperCase();
    return normalizedRole === 'COLLAB' || normalizedRole === 'COLLABORATEUR';
  }

  private buildRows(collaborateurs: Collaborateur[], affectations: Affectation[]): ChargeCollaborateur[] {
    return collaborateurs.map((collab) => {
      const actifs = affectations.filter((a) => {
        const s = this.normalizeStatut(a.projet?.statut);
        return a.collaborateur.id === collab.id && s !== 'termine' && s !== 'en_attente' && s !== 'en attente';
      });

      const projetsActifsMap = new Map<number, ChargeProjet>();
      for (const a of actifs) {
        const projetId = a.projet?.id;
        if (projetId == null) continue;
        projetsActifsMap.set(projetId, {
          id: projetId,
          nom: a.projet?.nom ?? 'Projet sans nom',
          statut: this.toProjetStatutLabel(a.projet?.statut)
        });
      }
      const projets = Array.from(projetsActifsMap.values());

      // Charge basée uniquement sur les affectations actives.
      // Sans projet actif : disponible et 0%.
      const chargeOccupation = actifs.length === 0
        ? 0
        : Math.min(100, Math.round(actifs.reduce((sum, a) => sum + (a.score ?? 0), 0) / actifs.length));
      const disponibilite = actifs.length === 0 ? 'Disponible' : 'Occupé';
      const prenom = collab.prenom ?? '';
      const nom = collab.nom ?? '';
      const initials = `${prenom.charAt(0)}${nom.charAt(0)}`.toUpperCase();
      const idx = Math.abs((collab.id ?? 0) % this.avatarPalette.length);

      return {
        id: collab.id ?? 0,
        prenom,
        nom,
        initials,
        disponibilite,
        chargeOccupation,
        projets,
        avatarColor: this.avatarPalette[idx]
      };
    });
  }

  private toProjetStatutLabel(statut: string | undefined): string {
    const normalized = this.normalizeStatut(statut);
    if (normalized === 'en cours' || normalized === 'en_cours') return 'En cours';
    if (normalized === 'termine') return 'Terminé';
    if (normalized === 'en attente' || normalized === 'en_attente') return 'En attente';
    return 'En attente';
  }

  private normalizeStatut(statut: string | undefined): string {
    return (statut ?? '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim();
  }
}


