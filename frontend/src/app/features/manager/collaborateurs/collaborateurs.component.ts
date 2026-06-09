import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ManagerShellComponent } from '../shared/manager-shell.component';
import { ManagerTopbarComponent } from '../shared/manager-topbar.component';
import { CollaborateurService, Collaborateur } from '../../../services/manager/collaborateur.service';
import { KpiCardComponent } from '../../../shared/kpi-card/kpi-card.component';

type ViewCollaborateur = Collaborateur & {
  initials: string;
  avatarColor: string;
  disponibilite: 'Disponible' | 'Occupé';
  experience: number;
};

@Component({
  selector: 'app-manager-collaborateurs',
  standalone: true,
  imports: [CommonModule, FormsModule, KpiCardComponent, ManagerShellComponent, ManagerTopbarComponent],
  templateUrl: './collaborateurs.component.html',
  styleUrl: './collaborateurs.component.scss'
})
export class ManagerCollaborateursComponent implements OnInit {
  collaborateurs: Collaborateur[] = [];
  filteredCollaborateurs: ViewCollaborateur[] = [];

  isLoading = false;
  errorMessage = '';

  showViewModal = false;
  selectedCollab: ViewCollaborateur | null = null;
  activeFilter = 'tous';
  searchTerm = '';

  readonly AVATAR_COLORS = ['#3b82f6', '#10b981', '#8b5cf6', '#f59e0b', '#ef4444', '#0ea5e9', '#d946ef', '#14b8a6'];

  constructor(
    private readonly collaborateurService: CollaborateurService,
    private readonly cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.charger();
  }

  charger(): void {
    this.isLoading = true;
    this.errorMessage = '';

    this.collaborateurService.getAll().subscribe({
      next: (data) => {
        this.collaborateurs = this.normalizeCollaborateurs(data);
        this.applyFilters();
        this.isLoading = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.errorMessage = 'Impossible de charger les collaborateurs.';
        this.isLoading = false;
        this.cdr.detectChanges();
      }
    });
  }

  get totalCount(): number {
    return this.collaborateurs.length;
  }

  get disponibleCount(): number {
    return this.collaborateurs.filter(c => c.disponible).length;
  }

  get occupeCount(): number {
    return this.collaborateurs.filter(c => !c.disponible).length;
  }

  get avgExperience(): number {
    if (!this.collaborateurs.length) return 0;
    const avg = this.collaborateurs.reduce((sum, c) => sum + c.experienceAnnees, 0) / this.collaborateurs.length;
    return Math.round(avg);
  }

  get totalCompetences(): number {
    return this.collaborateurs.reduce((sum, c) => sum + (c.competences?.length ?? 0), 0);
  }

  private toViewModel(c: Collaborateur): ViewCollaborateur {
    const initials = `${c.prenom?.charAt(0) ?? ''}${c.nom?.charAt(0) ?? ''}`.toUpperCase();
    const avatarColor = this.AVATAR_COLORS[((c.id ?? 0) % this.AVATAR_COLORS.length + this.AVATAR_COLORS.length) % this.AVATAR_COLORS.length];
    return {
      ...c,
      initials,
      avatarColor,
      disponibilite: c.disponible ? 'Disponible' : 'Occupé',
      experience: c.experienceAnnees
    };
  }

  private normalizeCollaborateurs(data: Collaborateur[]): Collaborateur[] {
    if (!Array.isArray(data)) {
      return [];
    }

    return data.filter((collaborateur) => this.isCollaborateurRole(collaborateur.role));
  }

  private isCollaborateurRole(role: string | undefined): boolean {
    const normalizedRole = (role ?? 'COLLAB').trim().toUpperCase();
    return normalizedRole === 'COLLAB' || normalizedRole === 'COLLABORATEUR';
  }

  onSearch(): void {
    this.applyFilters();
  }

  resetFilters(): void {
    this.searchTerm = '';
    this.activeFilter = 'tous';
    this.applyFilters();
  }

  setFilter(filter: string): void {
    this.activeFilter = filter;
    this.applyFilters();
  }

  applyFilters(): void {
    const term = this.searchTerm.toLowerCase().trim();

    let source = this.collaborateurs.filter(c => {
      if (!term) return true;
      return (
        c.nom.toLowerCase().includes(term) ||
        c.prenom.toLowerCase().includes(term) ||
        c.email.toLowerCase().includes(term) ||
        (c.competences ?? []).some(k => k.nom.toLowerCase().includes(term))
      );
    });

    if (this.activeFilter === 'disponibles') {
      source = source.filter(c => c.disponible);
    } else if (this.activeFilter === 'occupes') {
      source = source.filter(c => !c.disponible);
    }

    this.filteredCollaborateurs = source.map(c => this.toViewModel(c));
  }

  viewCollab(collab: ViewCollaborateur): void {
    this.selectedCollab = collab;
    this.showViewModal = true;
  }

  closeModals(): void {
    this.showViewModal = false;
  }
}
