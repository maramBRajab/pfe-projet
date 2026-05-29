import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AffectationService, Projet, ProjetService, ResultatAffectation } from '../../../../services/manager';
import { AuthService } from '../../../../services/auth';

@Component({
  selector: 'app-resultats',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './resultats.component.html',
  styleUrl: './resultats.component.scss'
})
export class ManagerResultatsComponent implements OnInit {
  currentDate = new Date();

  projets: Projet[] = [];
  projetIdSelectionne: number | null = null;
  resultats: ResultatAffectation[] = [];
  loading = false;
  loadingProjets = false;
  erreur = '';

  // État par collaborateur : 'idle' | 'loading' | 'done'
  affectationState: Record<number, 'idle' | 'loading' | 'done'> = {};
  toastMessage = '';
  toastType: 'success' | 'error' = 'success';
  private toastTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private projetService: ProjetService,
    private affectationService: AffectationService,
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
  }

  get projetsActifs(): number {
    return this.projets.filter(p => p.statut === 'en_cours').length;
  }

  get scoreMoyen(): number {
    if (!this.resultats.length) return 0;
    const total = this.resultats.reduce((sum, r) => sum + r.score, 0);
    return Math.round(total / this.resultats.length);
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
    return this.projets.find(p => p.id === this.projetIdSelectionne);
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
    return !this.projetIdSelectionne || this.loading || this.loadingProjets;
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
    if (!this.projetIdSelectionne || !r?.id) return;
    if (this.affectationState[r.id] === 'loading' || this.affectationState[r.id] === 'done') return;

    this.affectationState[r.id] = 'loading';
    this.cdr.detectChanges();

    this.affectationService.create({
      collaborateurId: r.id,
      projetId:        this.projetIdSelectionne,
      score:           r.score
    }).subscribe({
      next: () => {
        this.affectationState[r.id] = 'done';
        this.showToast(`${r.prenom} ${r.nom} affecté(e) au projet.`, 'success');
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
    if (!this.projetIdSelectionne) return;
    this.loading = true;
    this.erreur = '';
    this.resultats = [];
    this.affectationState = {};
    this.cdr.detectChanges();

    this.affectationService.affecter(this.projetIdSelectionne).subscribe({
      next: (data) => {
        this.resultats = [...data];
        this.loading = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Erreur:', err);
        this.erreur = 'Impossible de calculer les recommandations pour ce projet.';
        this.loading = false;
        this.cdr.detectChanges();
      }
    });
  }

  refreshProjets(): void {
    this.ngOnInit();
  }
}