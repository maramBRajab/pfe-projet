import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import {
  LucideFolder,
  LucidePlayCircle,
  LucideStar,
  LucideTarget,
  LucideZap
} from '@lucide/angular';
import { Affectation, AffectationService, Collaborateur, CollaborateurService, Projet, ProjetService, ResultatAffectation } from '../../../../services/manager';
import { AuthService } from '../../../../services/auth';
import { KpiCardComponent } from '../../../../shared/kpi-card/kpi-card.component';
import { ManagerShellComponent } from '../../shared/manager-shell.component';
import { ManagerTopbarComponent } from '../../shared/manager-topbar.component';

@Component({
  selector: 'app-resultats',
  standalone: true,
  imports: [CommonModule, FormsModule, DecimalPipe, KpiCardComponent, ManagerShellComponent, ManagerTopbarComponent],
  templateUrl: './resultats.component.html',
  styleUrl: './resultats.component.scss'
})
export class ManagerResultatsComponent implements OnInit {
  readonly folderIcon = LucideFolder;
  readonly playCircleIcon = LucidePlayCircle;
  readonly targetIcon = LucideTarget;
  readonly starIcon = LucideStar;
  readonly zapIcon = LucideZap;

  currentDate = new Date();

  projets: Projet[] = [];
  resultats: ResultatAffectation[] = [];
  loading = false;
  loadingProjets = false;
  erreur = '';

  // État par collaborateur : 'idle' | 'loading' | 'done'
  affectationState: Record<number, 'idle' | 'loading' | 'done'> = {};
  toastMessage = '';
  toastType: 'success' | 'error' = 'success';
  private toastTimer: ReturnType<typeof setTimeout> | null = null;

  // ── Nouvelle interface UI simplifiée ─────────────────────
  selectedProject: number | null = null;
  hasResults = false;
  recommendations: ResultatAffectation[] = [];

  get excellentsProfils(): number {
    return this.recommendations.filter(r => r.score >= 75).length;
  }

  affectationsEnCours: Affectation[] = [];
  collaborateursDisponibles: Collaborateur[] = [];
  loadingAffectations = false;
  changingAffectationId: number | null = null;
  deletingAffectationIds = new Set<number>();
  showChangeModal = false;
  selectedAffectationToChange: Affectation | null = null;
  selectedCollaborateurIdForChange: number | null = null;
  selectedAffectationToCancel: Affectation | null = null;

  constructor(
    private projetService: ProjetService,
    private affectationService: AffectationService,
    private collaborateurService: CollaborateurService,
    private cdr: ChangeDetectorRef,
    private router: Router,
    private authService: AuthService
  ) {}

  ngOnInit(): void {
    this.loadingProjets = true;
    this.projetService.getAll().subscribe({
      next: (data) => {
        this.projets = data;
        this.loadingProjets = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.erreur = 'Impossible de charger les projets à analyser.';
        this.loadingProjets = false;
        this.cdr.detectChanges();
      }
    });

    this.loadCollaborateursDisponibles();
  }

  get projetsActifs(): number {
    return this.projets.filter((p) => (p.statut ?? '').toLowerCase() === 'en_cours').length;
  }

  get projetsDisponibles(): number {
    return this.projets.length;
  }

  get projetsEnCours(): number {
    return this.projetsActifs;
  }

  get projetCibleCount(): number {
    return this.selectedProject ? 1 : 0;
  }

  get projetCibleLabel(): string {
    const projet = this.projetSelectionne;
    return projet ? projet.nom : 'Aucun sélectionné';
  }

  get scoreMoyen(): number {
    const source = this.hasResults ? this.recommendations : this.resultats;
    if (!source.length) return 0;
    return Math.round(source.reduce((s, r) => s + r.score, 0) / source.length);
  }

  get excellentsCount(): number {
    return this.resultats.filter(r => r.score >= 75).length;
  }

  get bonsCount(): number {
    return this.resultats.filter(r => r.score >= 50 && r.score < 75).length;
  }

  get faiblesCount(): number {
    return this.resultats.filter(r => r.score < 50).length;
  }

  get projetSelectionne(): Projet | undefined {
    return this.projets.find((p) => p.id === this.selectedProject);
  }

  get projetSelectionneNom(): string {
    return this.projetSelectionne?.nom ?? 'Aucun projet sélectionné';
  }

  get projetSelectionneDuree(): number {
    const projet = this.projetSelectionne;
    if (!projet?.dateDebut || !projet?.dateFin) return 0;
    const start = new Date(projet.dateDebut).getTime();
    const end = new Date(projet.dateFin).getTime();
    return Math.max(0, Math.round((end - start) / (1000 * 60 * 60 * 24)) + 1);
  }

  get projetSelectionneCompetences(): number {
    return this.projetSelectionne?.competencesRequises?.length ?? 0;
  }

  get meilleurResultat(): ResultatAffectation | undefined {
    return this.resultats[0];
  }

  get analyseDisabled(): boolean {
    return !this.selectedProject || this.loading || this.loadingProjets;
  }

  scoreLabel(score: number): string {
    if (score >= 75) return 'Excellent';
    if (score >= 50) return 'Bon';
    return 'À confirmer';
  }

  resultatPotentiel(score: number): string {
    if (score >= 75) return 'Couverture immédiate';
    if (score >= 50) return 'À surveiller';
    return 'À traiter';
  }

  projetStatutLabel(statut?: string): string {
    switch ((statut ?? '').toLowerCase()) {
      case 'en_cours':
        return 'En cours';
      case 'en_attente':
        return 'En attente';
      case 'termine':
        return 'Terminé';
      default:
        return 'Actif';
    }
  }

  scoreClass(score: number): string {
    if (score >= 75) return 'excellent';
    if (score >= 50) return 'bon';
    return 'faible';
  }

  scoreColor(score: number): string {
    if (score >= 75) return '#0EA472';
    if (score >= 50) return '#1565C0';
    return '#DC2626';
  }

  // ── Design v2 helpers ────────────────────────────

  scoreColorHex(score: number): string {
    if (score >= 75) return '#10b981';
    if (score >= 50) return '#f59e0b';
    return '#ef4444';
  }

  rankColor(index: number, score: number): string {
    if (index === 0) return score >= 75 ? '#10b981' : '#f59e0b';
    if (index === 1) return '#ef4444';
    return '#94a3b8';
  }

  qualityBadgeClass(score: number): string {
    if (score >= 75) return 'af-quality-badge--excellent';
    if (score >= 50) return 'af-quality-badge--bon';
    return 'af-quality-badge--confirmer';
  }

  potentielBadgeClass(score: number): string {
    if (score >= 75) return 'af-potentiel-badge--excellent';
    if (score >= 50) return 'af-potentiel-badge--surveiller';
    return 'af-potentiel-badge--traiter';
  }

  ficheOuverte = false;
  ficheCollab: ResultatAffectation | null = null;

  ouvrirFiche(r: ResultatAffectation): void {
    this.ficheCollab = r;
    this.ficheOuverte = true;
  }

  fermerFiche(): void {
    this.ficheOuverte = false;
  }

  ficheScoreClass(score: number): string {
    if (score >= 75) return 'fiche-score--excellent';
    if (score >= 50) return 'fiche-score--bon';
    return 'fiche-score--faible';
  }

  affecter(r: ResultatAffectation): void {
    if (!this.selectedProject || !r?.id) return;
    if (this.affectationState[r.id] === 'loading' || this.affectationState[r.id] === 'done') return;

    this.affectationState[r.id] = 'loading';
    this.cdr.detectChanges();

    this.affectationService.create({
      collaborateurId: r.id,
      projetId: this.selectedProject,
      score: r.score
    }).subscribe({
      next: () => {
        this.affectationState[r.id] = 'done';
        this.showToast(`${r.prenom} ${r.nom} affecté(e) au projet.`, 'success');
        this.loadAffectationsEnCours();
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Erreur création affectation:', err);
        this.affectationState[r.id] = 'idle';
        const detail = err?.error?.message || err?.message || '';
        this.showToast(`Échec de l'affectation${detail ? ' : ' + detail : ''}.`, 'error');
        this.cdr.detectChanges();
      }
    });
  }

  isAffected(r: ResultatAffectation): boolean {
    return this.affectationState[r.id] === 'done';
  }

  isAffecting(r: ResultatAffectation): boolean {
    return this.affectationState[r.id] === 'loading';
  }

  private showToast(message: string, type: 'success' | 'error'): void {
    this.toastMessage = message;
    this.toastType = type;
    if (this.toastTimer) clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => {
      this.toastMessage = '';
      this.cdr.detectChanges();
    }, 3500);
  }

  logout(): void {
    this.authService.logout();
    void this.router.navigate(['/login']);
  }

  lancer(): void {
    this.analyser();
  }

  refreshProjets(): void {
    this.ngOnInit();
  }

  // ── Méthodes nouvelle interface UI ───────────────────────

  onProjectSelect(): void {
    if (!this.selectedProject) {
      this.affectationsEnCours = [];
      this.loadingAffectations = false;
      this.cdr.detectChanges();
      return;
    }

    this.loadAffectationsEnCours();
    this.cdr.detectChanges();
  }

  analyser(): void {
    if (!this.selectedProject) {
      return;
    }

    this.loading = true;
    this.erreur = '';
    this.hasResults = false;
    this.resultats = [];
    this.recommendations = [];
    this.affectationState = {};
    this.cdr.detectChanges();

    this.affectationService.affecter(this.selectedProject).subscribe({
      next: (data) => {
        this.resultats = [...data];
        this.recommendations = [...data];
        this.hasResults = this.recommendations.length > 0;
        this.loadAffectationsEnCours();
        this.loading = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('❌ Erreur lors de l\'analyse:', err);
        this.erreur = 'Impossible de calculer les recommandations pour ce projet.';
        this.loading = false;
        this.hasResults = false;
        this.cdr.detectChanges();
      }
    });
  }

  competenceLabel(competence: unknown): string {
    if (typeof competence === 'string') {
      return competence;
    }

    if (competence && typeof competence === 'object' && 'nom' in competence) {
      const value = (competence as { nom?: string }).nom;
      return value ? value : 'Compétence';
    }

    return 'Compétence';
  }

  initiales(resultat: ResultatAffectation): string {
    const prenom = resultat.prenom?.trim() ?? '';
    const nom = resultat.nom?.trim() ?? '';
    return (prenom.charAt(0) + nom.charAt(0)).toUpperCase();
  }

  getInitials(prenom: string, nom: string): string {
    return ((prenom?.charAt(0) ?? '') + (nom?.charAt(0) ?? '')).toUpperCase();
  }

  formatStatut(statut: string): string {
    if (!statut) return '';
    return statut
      .replace(/_/g, ' ')
      .replace(/\b\w/g, (c) => c.toUpperCase());
  }

  get affectationsActives(): Affectation[] {
    if (!this.selectedProject) return [];
    return this.affectationsEnCours.filter(a => {
      const statut = (a.projet?.statut ?? '').toUpperCase().replace(/\s/g, '_');
      return statut !== 'TERMINE' && a.projet?.id === this.selectedProject;
    });
  }

  loadAffectationsEnCours(): void {
    if (!this.selectedProject) {
      this.affectationsEnCours = [];
      this.loadingAffectations = false;
      return;
    }

    this.loadingAffectations = true;
    const request$ = this.affectationService.getByProjet(this.selectedProject);

    request$.subscribe({
      next: (data) => {
        this.affectationsEnCours = data.filter((a) => this.isCollaborateurRole(a.collaborateur?.role));
        this.loadingAffectations = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.loadingAffectations = false;
        this.cdr.detectChanges();
      }
    });
  }

  private loadCollaborateursDisponibles(): void {
    this.collaborateurService.getDisponibles().subscribe({
      next: (data) => {
        this.collaborateursDisponibles = data.filter((c) => this.isCollaborateurRole(c.role));
        this.cdr.detectChanges();
      },
      error: () => {
        this.collaborateursDisponibles = [];
        this.cdr.detectChanges();
      }
    });
  }

  private isCollaborateurRole(role?: string): boolean {
    const normalizedRole = (role ?? 'COLLAB').trim().toUpperCase();
    return normalizedRole === 'COLLAB' || normalizedRole === 'COLLABORATEUR';
  }

  ouvrirChangerAffectation(affectation: Affectation): void {
    this.selectedAffectationToChange = affectation;
    this.selectedCollaborateurIdForChange = affectation.collaborateur?.id ?? null;
    this.showChangeModal = true;
  }

  fermerChangerAffectation(): void {
    this.showChangeModal = false;
    this.selectedAffectationToChange = null;
    this.selectedCollaborateurIdForChange = null;
  }

  confirmerChangerAffectation(): void {
    if (!this.selectedAffectationToChange?.id || !this.selectedCollaborateurIdForChange) {
      return;
    }

    const affectationId = this.selectedAffectationToChange.id;
    this.changingAffectationId = affectationId;

    this.affectationService.update(affectationId, { collaborateurId: this.selectedCollaborateurIdForChange }).subscribe({
      next: () => {
        this.changingAffectationId = null;
        this.fermerChangerAffectation();
        this.showToast('Affectation modifiée avec succès.', 'success');

        // Resync serveur: liste en cours + candidats disponibles pour la modale
        this.loadAffectationsEnCours();
        this.loadCollaborateursDisponibles();
        this.cdr.detectChanges();
      },
      error: () => {
        this.changingAffectationId = null;
        this.showToast("Impossible de modifier l'affectation.", 'error');
        this.cdr.detectChanges();
      }
    });
  }

  annulerAffectation(affectation: Affectation): void {
    if (!affectation?.id || this.deletingAffectationIds.has(affectation.id)) {
      return;
    }

    this.selectedAffectationToCancel = affectation;
  }

  fermerAnnulationAffectation(): void {
    this.selectedAffectationToCancel = null;
  }

  confirmerAnnulationAffectation(): void {
    const affectation = this.selectedAffectationToCancel;
    if (!affectation?.id || this.deletingAffectationIds.has(affectation.id)) {
      return;
    }

    this.fermerAnnulationAffectation();
    this.deletingAffectationIds.add(affectation.id);
    this.affectationService.delete(affectation.id).subscribe({
      next: () => {
        // Retire immédiatement la carte de la liste locale
        this.affectationsEnCours = this.affectationsEnCours.filter((a) => a.id !== affectation.id);
        this.deletingAffectationIds.delete(affectation.id);

        // Remet le bouton "Affecter" à disponible pour ce collaborateur
        const collabId = affectation.collaborateur?.id;
        if (collabId != null && this.affectationState[collabId] === 'done') {
          this.affectationState[collabId] = 'idle';
        }

        this.showToast('Affectation annulée.', 'success');

        // Resync depuis le serveur pour cohérence
        this.loadAffectationsEnCours();
        this.cdr.detectChanges();
      },
      error: () => {
        this.deletingAffectationIds.delete(affectation.id);
        this.showToast("Impossible d'annuler cette affectation.", 'error');
        this.cdr.detectChanges();
      }
    });
  }
}
