import { Component, OnInit, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { ProjetService, Projet, AffectationService, Affectation, ResultatAffectation } from '../../../../services/manager';
import { AuthService } from '../../../../services/auth';
import { ManagerFormulaireProjetComponent } from '../formulaire/formulaire.component';
import { ManagerNotificationsPanelComponent } from '../../notifications/notifications-panel.component';
import { ManagerNotificationsPanelService } from '../../shared/manager-notifications-panel.service';

@Component({
  selector: 'app-liste-projets',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, ManagerFormulaireProjetComponent, ManagerNotificationsPanelComponent],
  templateUrl: './liste.component.html',
  styleUrl: './liste.component.scss'
})
export class ManagerListeProjetsComponent implements OnInit {

  projets: Projet[] = [];
  searchTerm = '';
  statutFilter = 'all';
  viewMode: 'table' | 'cards' = 'table';
  isLoading = false;
  errorMessage = '';
  isCreateModalOpen = false;
  viewedProjet: Projet | null = null;
  editedProjetId: number | null = null;
  deleteTargetId: number | null = null;
  deleteTargetName = '';
  isDeleting = false;
  toastMessage = '';
  private toastTimer?: ReturnType<typeof setTimeout>;

  constructor(
    private service: ProjetService,
    private affectationService: AffectationService,
    private zone: NgZone,
    private readonly authService: AuthService,
    private readonly router: Router,
    readonly notificationsPanel: ManagerNotificationsPanelService
  ) {}

  openNotificationsPanel(): void {
    this.notificationsPanel.open();
  }

  logout(): void {
    this.authService.logout();
    void this.router.navigate(['/login']);
  }

  ngOnInit(): void {
    this.charger();
  }

  get filteredProjets(): Projet[] {
    const term = this.searchTerm.trim().toLowerCase();

    return this.projets.filter((projet) => {
      const matchesSearch =
        !term ||
        projet.nom.toLowerCase().includes(term) ||
        projet.description.toLowerCase().includes(term) ||
        this.statutLabel(projet.statut).toLowerCase().includes(term);

      const matchesStatut =
        this.statutFilter === 'all' || projet.statut === this.statutFilter;

      return matchesSearch && matchesStatut;
    });
  }

  get averageDuration(): number {
    const durations = this.projets
      .map((p) => this.projectDuration(p))
      .filter((d): d is number => d !== null);

    if (!durations.length) return 0;

    const total = durations.reduce((sum, d) => sum + d, 0);
    return Math.round(total / durations.length);
  }

  get totalCompetences(): number {
    return this.projets.reduce(
      (total, p) => total + this.competenceLabels(p).length,
      0
    );
  }

  get terminesCount(): number {
    return this.countStatut('termine');
  }

  charger(): void {
    this.isLoading = true;
    this.errorMessage = '';

    this.service.getAll().subscribe({
      next: (data) => {
        this.zone.run(() => {   // 🔥 FIX PRINCIPAL
          this.projets = data;
          this.isLoading = false;
        });
      },
      error: () => {
        this.zone.run(() => {
          this.errorMessage = 'Impossible de charger les projets à gérer.';
          this.isLoading = false;
        });
      }
    });
  }

  supprimer(id: number): void {
    const target = this.projets.find(p => p.id === id);
    this.deleteTargetId = id;
    this.deleteTargetName = target?.nom ?? 'ce projet';
  }

  closeDeleteModal(): void {
    if (this.isDeleting) return;
    this.deleteTargetId = null;
    this.deleteTargetName = '';
  }

  confirmerSuppression(): void {
    if (!this.deleteTargetId || this.isDeleting) return;
    this.isDeleting = true;
    const id = this.deleteTargetId;

    this.service.delete(id).subscribe({
      next: () => {
        this.zone.run(() => {
          this.projets = this.projets.filter(p => p.id !== id);
          this.showToast('Projet supprimé avec succès.');
          this.isDeleting = false;
          this.closeDeleteModal();
        });
      },
      error: (err) => {
        this.zone.run(() => {
          this.errorMessage = (err?.error?.message as string | undefined) || 'Impossible de supprimer ce projet.';
          this.isDeleting = false;
          this.closeDeleteModal();
        });
      }
    });
  }

  private showToast(message: string): void {
    this.toastMessage = message;
    if (this.toastTimer) clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => this.toastMessage = '', 2800);
  }

  clearFilters(): void {
    this.searchTerm = '';
    this.statutFilter = 'all';
  }

  openCreateModal(): void {
    this.errorMessage = '';
    this.isCreateModalOpen = true;
  }

  closeCreateModal(): void {
    this.isCreateModalOpen = false;
  }

  openViewModal(projet: Projet): void {
    this.viewedProjet = projet;
    this.resetAffectationState();
    this.loadProjetAffectations(projet);
  }

  closeViewModal(): void {
    this.viewedProjet = null;
    this.resetAffectationState();
  }

  // ── AFFECTATION INSIDE MODAL ─────────────────────────────────────
  showAffectationPanel = false;
  loadingRecommandations = false;
  recommandations: ResultatAffectation[] = [];
  affectationsExistantes: Affectation[] = [];
  affectationError = '';
  affectationState: Record<number, 'idle' | 'loading' | 'done'> = {};

  private resetAffectationState(): void {
    this.showAffectationPanel = false;
    this.loadingRecommandations = false;
    this.recommandations = [];
    this.affectationsExistantes = [];
    this.affectationError = '';
    this.affectationState = {};
  }

  private loadProjetAffectations(projet: Projet): void {
    if (!projet.id) return;
    this.affectationService.getByProjet(projet.id).subscribe({
      next: (list) => this.zone.run(() => {
        this.affectationsExistantes = list ?? [];
        for (const a of this.affectationsExistantes) {
          if (a.collaborateur?.id) {
            this.affectationState[a.collaborateur.id] = 'done';
          }
        }
      }),
      error: () => { /* silencieux */ }
    });
  }

  ouvrirAffectation(): void {
    if (!this.viewedProjet?.id) return;
    this.showAffectationPanel = true;
    this.loadingRecommandations = true;
    this.affectationError = '';
    this.recommandations = [];

    this.affectationService.affecter(this.viewedProjet.id).subscribe({
      next: (data) => this.zone.run(() => {
        this.recommandations = data ?? [];
        this.loadingRecommandations = false;
      }),
      error: () => this.zone.run(() => {
        this.affectationError = 'Impossible de calculer les recommandations.';
        this.loadingRecommandations = false;
      })
    });
  }

  fermerAffectation(): void {
    this.showAffectationPanel = false;
  }

  affecterCollab(r: ResultatAffectation): void {
    if (!this.viewedProjet?.id || !r?.id) return;
    if (this.affectationState[r.id] === 'loading' || this.affectationState[r.id] === 'done') return;
    this.affectationState[r.id] = 'loading';
    this.affectationService.create({
      collaborateurId: r.id,
      projetId:        this.viewedProjet.id,
      score:           r.score
    }).subscribe({
      next: (created) => this.zone.run(() => {
        this.affectationState[r.id] = 'done';
        this.affectationsExistantes = [...this.affectationsExistantes, created];
        this.showToast(`${r.prenom} ${r.nom} affecté(e) au projet.`);
      }),
      error: (err) => this.zone.run(() => {
        console.error('Erreur affectation:', err);
        this.affectationState[r.id] = 'idle';
        this.affectationError = err?.error?.message || "Échec de l'affectation.";
      })
    });
  }

  isAffected(r: ResultatAffectation): boolean { return this.affectationState[r?.id] === 'done'; }
  isAffecting(r: ResultatAffectation): boolean { return this.affectationState[r?.id] === 'loading'; }

  ressourceCount(): number { return this.affectationsExistantes.length; }

  openEditModal(id: number): void {
    this.editedProjetId = id;
  }

  closeEditModal(): void {
    this.editedProjetId = null;
  }

  onEditSaved(): void {
    this.zone.run(() => {
      this.editedProjetId = null;
      this.charger();
    });
  }

  onProjectCreated(): void {
    this.zone.run(() => {
      this.isCreateModalOpen = false;
      this.charger();
    });
  }

  editProjectLink(id: number | undefined): Array<string | number> {
    return ['/manager/projets/edit', id ?? 0];
  }

  trackByProjet(_: number, projet: Projet): number | string {
    return projet.id ?? projet.nom;
  }

  competenceLabels(projet: Projet): string[] {
    return (projet.competencesRequises ?? []).map((c: any) => {
      if (typeof c === 'string') return c;
      return c?.nom ?? c?.label ?? 'Competence';
    });
  }

  projectDuration(projet: Projet): number | null {
    if (!projet.dateDebut || !projet.dateFin) return null;

    const start = new Date(projet.dateDebut);
    const end = new Date(projet.dateFin);
    const diff = end.getTime() - start.getTime();

    if (Number.isNaN(diff) || diff < 0) return null;

    return Math.max(1, Math.ceil(diff / (1000 * 60 * 60 * 24)));
  }

  descriptionPreview(description: string): string {
    if (!description) return 'Aucune description.';
    return description.length > 90 ? `${description.slice(0, 90)}...` : description;
  }

  durationLabel(projet: Projet): string {
    const duration = this.projectDuration(projet);
    return duration ? `${duration} jours` : 'Non defini';
  }

  badgeClass(statut: string): string {
    const map: Record<string, string> = {
      en_attente: 'amber',
      en_cours: 'blue',
      termine: 'green'
    };
    return map[statut] ?? 'amber';
  }

  statutLabel(statut: string): string {
    const map: Record<string, string> = {
      en_attente: 'En attente',
      en_cours: 'En cours',
      termine: 'Terminé'
    };
    return map[statut] ?? statut;
  }

  countStatut(statut: string): number {
    return this.projets.filter(p => p.statut === statut).length;
  }

  // ── Design v2 helpers ────────────────────────────────

  private readonly _avatarPalette = ['#3b82f6', '#8b5cf6', '#06b6d4', '#f59e0b', '#10b981', '#ef4444'];

  avatarColor(index: number): string {
    return this._avatarPalette[index % this._avatarPalette.length];
  }

  durationShort(projet: Projet): string {
    const d = this.projectDuration(projet);
    return d ? `${d} j` : '—';
  }

  statusBadgeClass(statut: string): string {
    const map: Record<string, string> = {
      en_cours:   'pj-status--active',
      en_attente: 'pj-status--pending',
      termine:    'pj-status--done',
    };
    return map[statut] ?? 'pj-status--pending';
  }

  exportCsv(): void {
    const header = ['ID', 'Nom', 'Description', 'Statut', 'Début', 'Fin', 'Durée (j)'].join(';');
    const rows = this.filteredProjets.map(p => [
      p.id ?? '',
      p.nom,
      p.description ?? '',
      this.statutLabel(p.statut),
      p.dateDebut ?? '',
      p.dateFin ?? '',
      this.projectDuration(p) ?? '',
    ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(';'));
    const csv = [header, ...rows].join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url; link.download = 'projets.csv'; link.click();
    URL.revokeObjectURL(url);
  }
}