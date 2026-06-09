import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule }                  from '@angular/common';
import { Router, RouterLink }             from '@angular/router';
import { Subject, forkJoin }              from 'rxjs';
import { catchError, of }                 from 'rxjs';
import { ManagerShellComponent }          from '../shared/manager-shell.component';
import { ManagerTopbarComponent }         from '../shared/manager-topbar.component';
import { KpiCardComponent }               from '../../../shared/kpi-card/kpi-card.component';
import {
  Affectation,
  AffectationService,
  Collaborateur as ApiCollaborateur,
  CollaborateurService,
  ChatbotService,
  ManagerDashboardService,
  ManagerDashboardStats,
  ManagerIaService,
  ProjetService,
  Projet as ApiProjet
} from '../../../services/manager';

// ─── Interfaces ──────────────────────────────────────────────

export interface KpiCard {
  label:      string;
  value:      string | number;
  sub:        string;
  badge:      string;
  badgeType:  'pilotage' | 'stable' | 'warning' | 'danger' | 'ai' | 'neutral';
  icon:       string;
  color:      'blue' | 'green' | 'orange' | 'purple' | 'red' | 'cyan';
  valueColor: 'blue' | 'green' | 'orange' | 'purple' | 'red' | 'default' | 'muted';
  type?:      string;
}

export interface AssistantAiStats {
  loading: boolean;
  error: string;
  snapshot: string;
}

export interface MembreEquipe {
  name:     string;
  initials: string;
  color:    string;
}

export interface Projet {
  id:              string;
  name:            string;
  client:          string;
  status:          string;
  statusClass:     'pending' | 'active' | 'paused' | 'danger';
  resourceCount:   number;
  deadline:        Date;
  progress:        number;
  progressColor:   'blue' | 'green' | 'orange' | 'red';
  team:            MembreEquipe[];
  requiredSkills?: string[];
  description?:    string;
}

export interface Collaborateur {
  id:           string;
  name:         string;
  initials:     string;
  role:         string;
  color:        string;
  loadPercent:  number;
  loadClass:    'low' | 'medium' | 'high';
  status:       string;
  statusClass:  'available' | 'occupied' | 'unavailable';
  projectCount: number;
  skills?:      string[];
}

export interface Recommandation {
  id:               string;
  collaborateur:    string;
  collaborateurId:  string;
  projet:           string;
  projetId:         string;
  score:            number;
  competencesMatch: string[];
}

export interface Alerte {
  id:         string;
  message:    string;
  sub:        string;
  type:       'warning' | 'info' | 'success' | 'danger';
  actionUrl?: string;
}

export interface HistoriqueAffectation {
  id:                  number;
  collaborateurNom:    string;
  collaborateurInit:   string;
  collaborateurColor:  string;
  projet:              string;
  profil:              string;
  score:               number;
  date:                Date;
}

interface ConfirmationDialog {
  visible: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  action: (() => void) | null;
}
// ─── Component ───────────────────────────────────────────────

@Component({
  selector:    'app-manager-dashboard',
  templateUrl: './dashboard.component.html',
  styleUrls:   ['./dashboard.component.scss'],
  standalone:  true,
  imports:     [CommonModule, RouterLink, KpiCardComponent, ManagerShellComponent, ManagerTopbarComponent],
})
export class ManagerDashboardComponent implements OnInit, OnDestroy {

  private destroy$ = new Subject<void>();

  currentDate    = new Date();
  lastUpdated    = new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  isFluxMaitrise = true;
  userMenuOpen   = false;
  historyFilter: 'all' | 'month' | 'modified' = 'all';
  deletingProjectIds = new Set<number>();
  deletingAffectationIds = new Set<number>();
  assistantAiStats: AssistantAiStats = {
    loading: true,
    error: '',
    snapshot: ''
  };
  confirmationDialog: ConfirmationDialog = {
    visible: false,
    title: '',
    message: '',
    confirmLabel: 'Confirmer',
    action: null
  };

  // ── KPI Cards ─────────────────────────────────────────────
  kpiCards: KpiCard[] = [
    { label: 'PROJETS ACTIFS',        value: 3,     sub: '2 prioritaire(s)',               badge: 'Pilotage', badgeType: 'pilotage', icon: 'folder',         color: 'blue',   valueColor: 'blue',   type: 'primary'   },
    { label: 'RESSOURCES DISPONIBLES',value: 2,     sub: 'sur 3 collaborateurs',           badge: 'Stable',   badgeType: 'stable',   icon: 'users',          color: 'green',  valueColor: 'green',  type: 'secondary' },
    { label: 'AFFECTATIONS EN COURS', value: 6,     sub: 'pilotage des engagements',        badge: 'Pilotage', badgeType: 'pilotage', icon: 'arrow-right',    color: 'orange', valueColor: 'orange', type: 'primary'   },
    { label: 'TAUX D\'AFFECTATION',   value: '67%', sub: '',                                  badge: 'Vigilance',badgeType: 'warning',  icon: 'activity',       color: 'purple', valueColor: 'purple', type: 'primary'   },
    { label: 'ALERTES PRIORITAIRES',  value: 1,     sub: '1 alerte(s) active(s)',           badge: 'Pilotage', badgeType: 'pilotage', icon: 'alert-triangle', color: 'red',    valueColor: 'default',type: 'warning'   },
    { label: 'COMPATIBILITÉ IA',      value: '51%', sub: 'score moyen des dernières affectations', badge: 'IA',       badgeType: 'ai',       icon: 'cpu',            color: 'cyan',   valueColor: 'muted',  type: 'ai'        },
  ];

  // ── Projets ───────────────────────────────────────────────
  projets: Projet[] = [];

  // ── Collaborateurs ────────────────────────────────────────
  collaborateurs: Collaborateur[] = [];

  // ── Recommandations ───────────────────────────────────────
  recommandations: Recommandation[] = [];

  // ── Alertes ───────────────────────────────────────────────
  alertes: Alerte[] = [];
  managerStats: ManagerDashboardStats | null = null;

  // ── Affectations ──────────────────────────────────────────
  affectations: HistoriqueAffectation[] = [];

  get filteredHistory(): HistoriqueAffectation[] {
    const now = new Date();
    switch (this.historyFilter) {
      case 'month':    return this.affectations.filter(h => (now.getTime() - h.date.getTime()) / 86400000 <= 30);
      case 'modified': return this.affectations.filter(h => h.score > 15);
      default:         return this.affectations;
    }
  }

  get subtitleDate(): string {
    return this.currentDate.toLocaleDateString('fr-FR', {
      weekday: 'long',
      day: '2-digit',
      month: 'long',
      year: 'numeric'
    });
  }

  get activeProjectsCount(): number {
    return this.projets.filter(p => p.statusClass !== 'paused').length;
  }

  get priorityProjectsCount(): number {
    return this.projets.filter(p => p.statusClass === 'pending').length;
  }

  get availableResourcesCount(): number {
    return this.collaborateurs.filter(c => c.statusClass === 'available').length;
  }

  get allocationRateValue(): number {
    const rate = Number.parseInt(this.tauxAffectation.replace('%', ''), 10);
    return Number.isFinite(rate) ? rate : 0;
  }

  get allocationRateClass(): 'high' | 'normal' {
    return this.allocationRateValue > 90 ? 'high' : 'normal';
  }

  get averageIaScore(): number {
    const fromRecommandations = this.recommandations.map(r => r.score);
    if (fromRecommandations.length) {
      return Math.round(fromRecommandations.reduce((a, b) => a + b, 0) / fromRecommandations.length);
    }

    const fromHistory = this.affectations.map(a => a.score);
    if (!fromHistory.length) return 0;
    return Math.round(fromHistory.reduce((a, b) => a + b, 0) / fromHistory.length);
  }

  get iaTotalCount(): number {
    return this.recommandations.length || this.affectations.length;
  }

  get assistantAiAvailableCount(): number {
    return this.extractAssistantAiNumber(/nb_collaborateurs_disponibles=(\d+)/) ?? this.availableResourcesCount;
  }

  get assistantAiAllocationRate(): number {
    return this.extractAssistantAiNumber(/taux_affectation=(\d+)/) ?? this.allocationRateValue;
  }

  get assistantAiOverloadedCount(): number {
    return this.extractAssistantAiNumber(/collaborateurs_surcharges=(\d+)/) ?? this.overloadedCollaboratorsCount;
  }

  get assistantAiLastSyncLabel(): string {
    if (this.assistantAiStats.loading) {
      return 'Mise à jour des indicateurs IA';
    }

    return this.assistantAiStats.snapshot
      ? 'Données synchronisées via /manager/ia/analyse'
      : 'Indicateurs calculés à partir des données manager';
  }

  get assistantAiLoading(): boolean {
    return this.assistantAiStats.loading;
  }

  get assistantAiError(): string {
    return this.assistantAiStats.error;
  }

  private readonly avatarPalette = ['#3b82f6', '#10b981', '#8b5cf6', '#f59e0b', '#ef4444', '#06b6d4', '#14b8a6', '#d946ef'];

  constructor(
    private router: Router,
    private affectationService: AffectationService,
    private projetService: ProjetService,
    private collaborateurService: CollaborateurService,
    private managerDashboardService: ManagerDashboardService,
    private managerIaService: ManagerIaService,
    private chatbotService: ChatbotService
  ) {}

  ngOnInit(): void {
    this.loadManagerStats();
    this.loadPriorityAlerts();
    this.loadAssistantAiStats();

    // Charger les vrais projets (les plus récents en premier)
    this.projetService.getAll().pipe(catchError(() => of([] as ApiProjet[]))).subscribe(list => {
      const sorted = [...list].sort((a, b) => (b.id ?? 0) - (a.id ?? 0));
      this.projets = sorted.map(p => this.mapProjet(p));
      this.apiProjetsById = new Map(sorted.map(p => [`proj-${p.id}`, p]));
      this.refreshResourceCounts();
      this.updateKpiCards();
    });

    forkJoin({
      affectations: this.affectationService.getAll().pipe(catchError(() => of([] as Affectation[]))),
      collaborateurs: this.collaborateurService.getAll().pipe(catchError(() => of([] as ApiCollaborateur[])))
    }).subscribe(({ affectations, collaborateurs }) => {
      this.rawAffectations = affectations;
      this.rawCollaborateurs = collaborateurs;
      this.affectations = affectations.map(a => ({
        id: a.id,
        collaborateurNom: a.collaborateur.prenom + ' ' + a.collaborateur.nom,
        collaborateurInit: ((a.collaborateur.prenom?.[0] ?? '') + (a.collaborateur.nom?.[0] ?? '')).toUpperCase(),
        collaborateurColor: '#10b981',
        projet: a.projet?.nom ?? '—',
        profil: 'Consultant',
        score: a.score,
        date: new Date(a.dateAffectation)
      }));
      this.rebuildCollaborateursFromApi();
      this.refreshResourceCounts();
      this.updateKpiCards();
    });
  }

  private rawAffectations: Affectation[] = [];
  private rawCollaborateurs: ApiCollaborateur[] = [];

  private rebuildCollaborateursFromApi(): void {
    if (!this.rawCollaborateurs.length) {
      this.collaborateurs = [];
      return;
    }

    const computed = this.rawCollaborateurs.map((collab) => {
      const actifs = this.rawAffectations.filter((a) =>
        a.collaborateur.id === collab.id && a.projet.statut !== 'termine'
      );

      // Charge basée uniquement sur les affectations actives.
      // Sans projet actif : disponible et 0%.
      let charge: number;
      if (actifs.length === 0) {
        charge = 0;
      } else {
        const avgScore = actifs.reduce((sum, a) => sum + (a.score ?? 0), 0) / actifs.length;
        charge = Math.min(100, Math.round(avgScore));
      }

      const prenom = (collab.prenom ?? '').trim();
      const nom = (collab.nom ?? '').trim();
      const name = `${prenom} ${nom}`.trim() || collab.email || 'Collaborateur';
      const initials = `${prenom.charAt(0)}${nom.charAt(0)}`.toUpperCase() || name.slice(0, 2).toUpperCase();
      const id = collab.id ?? 0;
      const color = this.avatarPalette[Math.abs(id) % this.avatarPalette.length];
      const loadClass: Collaborateur['loadClass'] = charge <= 30 ? 'low' : charge <= 70 ? 'medium' : 'high';
      const statusClass: Collaborateur['statusClass'] = collab.disponible ? 'available' : 'occupied';

      return {
        id: `c${id}`,
        name,
        initials,
        role: 'Collaborateur',
        color,
        loadPercent: charge,
        loadClass,
        status: collab.disponible ? 'Disponible' : 'Occupé',
        statusClass,
        projectCount: actifs.length,
      } satisfies Collaborateur;
    });

    this.collaborateurs = computed
      .filter(c => c.role !== 'Manager' && c.role !== 'Admin')
      .sort((a, b) => b.loadPercent - a.loadPercent)
      .slice(0, 3);
  }

  private refreshResourceCounts(): void {
    if (!this.projets.length) return;
    const counts = new Map<string, number>();
    const firstColab = new Map<string, string>();
    for (const a of this.rawAffectations) {
      const pid = a.projet?.id;
      if (pid == null) continue;
      const key = `proj-${pid}`;
      counts.set(key, (counts.get(key) ?? 0) + 1);
      if (!firstColab.has(key) && a.collaborateur) {
        firstColab.set(key, `${a.collaborateur.prenom ?? ''} ${a.collaborateur.nom ?? ''}`.trim());
      }
    }
    this.projets = this.projets.map(p => ({
      ...p,
      resourceCount: counts.get(p.id) ?? 0,
      client: firstColab.get(p.id) || p.client,
    }));
  }

  clientInitials(name: string): string {
    if (!name) return '—';
    const parts = name.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return '—';
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }

  private loadManagerStats(): void {
    this.managerDashboardService.getStats()
      .pipe(catchError(() => of(null)))
      .subscribe((stats) => {
        this.managerStats = stats;
        this.updateKpiCards();
      });
  }

  private loadPriorityAlerts(): void {
    this.managerDashboardService.getPriorityAlerts()
      .pipe(catchError(() => of(null)))
      .subscribe((response) => {
        if (!response) {
          return;
        }

        this.alertes = response.items.map((item, index) => ({
          id: `priority-${index}`,
          message: item.title,
          sub: item.description,
          type: item.type === 'danger' ? 'danger' : item.type === 'warning' ? 'warning' : 'info',
          actionUrl: item.link
        }));
        this.updateKpiCards();
      });
  }

  private apiProjetsById = new Map<string, ApiProjet>();

  private mapProjet(p: ApiProjet): Projet {
    const statut = (p.statut || '').toUpperCase();
    let status = p.statut || '—';
    let statusClass: 'pending' | 'active' | 'paused' | 'danger' = 'pending';
    if (statut.includes('COURS')) { status = 'En cours'; statusClass = 'active'; }
    else if (statut.includes('ATTENTE')) { status = 'En attente'; statusClass = 'pending'; }
    else if (statut.includes('RETARD')) { status = 'En retard'; statusClass = 'danger'; }
    else if (statut.includes('PAUSE')) { status = 'En pause'; statusClass = 'paused'; }
    else if (statut.includes('TERMIN')) { status = 'Terminé'; statusClass = 'paused'; }

    // Utiliser la progression calculée côté backend (basée sur les tâches terminées)
    let progress = typeof p.progression === 'number' ? p.progression : 0;
    if (statut.includes('TERMIN')) progress = 100;

    const progressColor: 'blue' | 'green' | 'orange' | 'red' =
      progress >= 75 ? 'green' : progress >= 50 ? 'blue' : progress >= 25 ? 'orange' : 'red';

    return {
      id: `proj-${p.id}`,
      name: p.nom,
      client: (p.description ?? '').trim().slice(0, 24) || '—',
      status,
      statusClass,
      resourceCount: 0,
      deadline: new Date(p.dateFin),
      progress,
      progressColor,
      team: [],
      requiredSkills: (p.competencesRequises ?? []).map(c => c.nom),
      description: p.description,
    };
  }
  ngOnDestroy(): void { this.destroy$.next(); this.destroy$.complete(); }

  private updateKpiCards(): void {
    const stats = this.managerStats;
    
    // Projets actifs = projets EN_COURS
    const projetsActifs = this.projets.filter(p => 
      p.statusClass === 'active').length;
    const projetsEnRetard = this.projets.filter(p => 
      p.statusClass === 'danger').length;
      
    // Ressources disponibles
    const disponibles = this.rawCollaborateurs.filter(c => 
      c.disponible === true).length;
    const total = this.rawCollaborateurs.length;
    
    // Taux affectation
    const affectesIds = new Set(
      this.rawAffectations
        .filter(a => a.projet?.statut !== 'termine')
        .map(a => a.collaborateur?.id)
        .filter(id => id != null)
    );
    const taux = total > 0 ? Math.round((affectesIds.size / total) * 100) : 0;
    
    // Compatibilité IA
    const scores = this.rawAffectations.map(a => a.score ?? 0);
    const compatIa = scores.length > 0
      ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
      : 0;

    this.kpiCards[0].value = projetsActifs;
    this.kpiCards[0].sub = projetsEnRetard + ' en retard';
    this.kpiCards[1].value = disponibles;
    this.kpiCards[1].sub = 'sur ' + total + ' collaborateurs';
    this.kpiCards[2].value = this.rawAffectations.length;
    this.kpiCards[3].value = taux + '%';
    this.kpiCards[3].sub = 'Cible recommandée : 72%';
    this.kpiCards[4].value = this.alertes.length;
    this.kpiCards[4].sub = this.alertes.length + ' active(s)';
    this.kpiCards[5].value = compatIa + '%';

    this.managerStats = {
      projetsActifs: stats?.projetsActifs ?? projetsActifs,
      projetsEnRetard: stats?.projetsEnRetard ?? projetsEnRetard,
      ressourcesDisponibles: stats?.ressourcesDisponibles ?? disponibles,
      totalCollaborateurs: stats?.totalCollaborateurs ?? total,
      tauxAffectation: stats?.tauxAffectation ?? taux,
      alertesPrioritaires: stats?.alertesPrioritaires ?? this.alertes.length,
      affectationsEnCours: stats?.affectationsEnCours ?? this.rawAffectations.length,
      collaborateursSurcharges: stats?.collaborateursSurcharges ?? this.overloadedCollaboratorsCount,
      compatibiliteIa: stats?.compatibiliteIa ?? compatIa
    };
  }

  private loadAssistantAiStats(): void {
    this.assistantAiStats = {
      ...this.assistantAiStats,
      loading: true,
      error: ''
    };

    this.managerIaService.analyse('stats globales').pipe(
      catchError(() => of({ reponse: '' }))
    ).subscribe((result) => {
      const snapshot = result?.reponse ?? '';
      this.assistantAiStats = {
        loading: false,
        error: snapshot ? '' : 'Analyse IA indisponible pour le moment.',
        snapshot
      };
    });
  }

  private extractAssistantAiNumber(pattern: RegExp): number | null {
    const match = this.assistantAiStats.snapshot.match(pattern);
    if (!match) {
      return null;
    }

    const value = Number.parseInt(match[1] ?? '', 10);
    return Number.isFinite(value) ? value : null;
  }

  get overloadedCollaboratorsCount(): number {
    return this.collaborateurs.filter((collaborateur) => collaborateur.loadPercent >= 80).length;
  }

  // ── Navigation & actions ──────────────────────────────────
  refresh(): void                              { this.loadManagerStats(); this.loadPriorityAlerts(); this.updateKpiCards(); this.loadAssistantAiStats(); this.lastUpdated = new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }); }
  refreshData(): void                          { this.refresh(); }
  toggleUserMenu(): void                       { this.userMenuOpen = !this.userMenuOpen; }
  navigateTo(path: string): void               { this.userMenuOpen = false; this.router.navigate([path]); }
  logout(): void                               { this.userMenuOpen = false; this.router.navigate(['/login']); }
  openNewProject(): void                       { this.router.navigate(['/manager/projets/nouveau']); }
  viewAllProjects(): void                      { this.router.navigate(['/manager/projets']); }

  editProject(p: Projet): void                { this.router.navigate(['/manager/projets/edit', p.id]); }
  viewAffectations(p: Projet): void           { this.router.navigate(['/manager/affectations-en-cours'], { queryParams: { project: p.id } }); }
  assignCollaborator(p: Projet): void         { this.router.navigate(['/manager/affectations/nouveau'], { queryParams: { project: p.id } }); }
  deleteProject(p: Projet): void {
    const apiProjectId = this.resolveProjetNumericId(p);
    if (apiProjectId == null) {
      window.alert('Impossible de supprimer ce projet : identifiant backend introuvable.');
      return;
    }

    this.openConfirmation({
      title: 'Supprimer le projet',
      message: `Supprimer le projet "${p.name}" ? Cette action le supprimera definitivement de la base de donnees.`,
      confirmLabel: 'Supprimer',
      action: () => {
        if (this.deletingProjectIds.has(apiProjectId)) {
          return;
        }

        this.deletingProjectIds.add(apiProjectId);
        this.projetService.delete(apiProjectId).subscribe({
          next: () => {
            this.projets = this.projets.filter(x => x.id !== p.id);
            this.apiProjetsById.delete(p.id);
            this.rawAffectations = this.rawAffectations.filter(a => a.projet?.id !== apiProjectId);
            this.affectations = this.affectations.filter(a => a.projet !== p.name);
            this.refreshResourceCounts();
            this.rebuildCollaborateursFromApi();
            this.updateKpiCards();
            this.deletingProjectIds.delete(apiProjectId);
          },
          error: (err) => {
            this.deletingProjectIds.delete(apiProjectId);
            const message = (err?.error?.message as string | undefined) || 'Impossible de supprimer ce projet.';
            window.alert(message);
          }
        });
      }
    });
  }

  private resolveProjetNumericId(projet: Projet): number | null {
    const fromMap = this.apiProjetsById.get(projet.id)?.id;
    if (typeof fromMap === 'number') {
      return fromMap;
    }

    const parsed = Number.parseInt(projet.id.replace(/^proj-/, ''), 10);
    return Number.isFinite(parsed) ? parsed : null;
  }

  viewCollaboratorProfile(c: Collaborateur): void { this.router.navigate(['/manager/collaborateurs', c.id]); }
  assignToProject(c: Collaborateur): void         { this.router.navigate(['/manager/affectations/nouveau'], { queryParams: { collaborateur: c.id } }); }
  viewFullAnalysis(): void                        { this.router.navigate(['/manager/charge-travail']); }

  openRecommendations(): void                      { this.router.navigate(['/manager/recommandations']); }
  exportDashboard(): void                         { this.refreshData(); }
  exportDashboardPdf(): void                      { window.print(); }
  applyRecommendation(r: Recommandation): void    { this.router.navigate(['/manager/affectations/nouveau'], { queryParams: { collaborateur: r.collaborateurId, project: r.projetId } }); }
  dismissRecommendation(r: Recommandation): void  { this.recommandations = this.recommandations.filter(x => x.id !== r.id); this.updateKpiCards(); }

  openAlertAction(a: Alerte): void  { if (a.actionUrl) this.router.navigateByUrl(a.actionUrl); }
  dismissAlerte(a: Alerte): void    { this.alertes = this.alertes.filter(x => x.id !== a.id); this.updateKpiCards(); }

  setHistoryFilter(f: 'all' | 'month' | 'modified'): void { this.historyFilter = f; }
  openHistoryPage(): void                                   { this.router.navigate(['/manager/historique-affectations']); }
  editAffectation(e: HistoriqueAffectation): void          { this.router.navigate(['/manager/affectations', e.id, 'edit']); }
  cancelAffectation(e: HistoriqueAffectation): void {
    if (this.deletingAffectationIds.has(e.id)) {
      return;
    }

    this.openConfirmation({
      title: 'Annuler l’affectation',
      message: `Annuler l'affectation de ${e.collaborateurNom} sur ${e.projet} ?`,
      confirmLabel: 'Annuler l’affectation',
      action: () => {
        if (this.deletingAffectationIds.has(e.id)) {
          return;
        }

        this.deletingAffectationIds.add(e.id);
        this.affectationService.delete(e.id).subscribe({
          next: () => {
            this.affectations = this.affectations.filter(x => x.id !== e.id);
            this.rawAffectations = this.rawAffectations.filter(x => x.id !== e.id);
            this.refreshResourceCounts();
            this.rebuildCollaborateursFromApi();
            this.loadManagerStats();
            this.updateKpiCards();
            this.deletingAffectationIds.delete(e.id);
          },
          error: (err) => {
            this.deletingAffectationIds.delete(e.id);
            const message = (err?.error?.message as string | undefined) || "Impossible d'annuler cette affectation.";
            window.alert(message);
          }
        });
      }
    });
  }

  openConfirmation(config: Omit<ConfirmationDialog, 'visible'>): void {
    this.confirmationDialog = {
      visible: true,
      ...config
    };
  }

  closeConfirmation(): void {
    this.confirmationDialog = {
      visible: false,
      title: '',
      message: '',
      confirmLabel: 'Confirmer',
      action: null
    };
  }

  confirmCurrentAction(): void {
    const action = this.confirmationDialog.action;
    this.closeConfirmation();
    action?.();
  }

  getProjectBorderColor(status: string): string {
    const map: Record<string, string> = { 'EN ATTENTE': 'yellow', 'EN COURS': 'green', 'TERMINÉ': 'gray', 'EN RETARD': 'red' };
    return map[status] ?? 'gray';
  }

  getScoreClass(score: number): 'high' | 'medium' | 'low' {
    return score >= 70 ? 'high' : score >= 40 ? 'medium' : 'low';
  }

  // ── Template helpers (design v2) ──────────────────────────

  get tauxAffectation(): string {
    const total = this.rawCollaborateurs.length;
    if (total === 0) return '0%';
    // Collaborateurs ayant au moins une affectation sur un projet non terminé
    const affectesIds = new Set(
      this.rawAffectations
        .filter(a => a.projet?.statut !== 'termine')
        .map(a => a.collaborateur?.id)
        .filter(id => id != null)
    );
    return `${Math.round((affectesIds.size / total) * 100)}%`;
  }

  projBorderColor(p: Projet): string {
    const map: Record<string, string> = { green: '#10b981', orange: '#f59e0b', red: '#ef4444', blue: '#3b82f6' };
    return map[p.progressColor] ?? '#e2e8f0';
  }

  projProgressColor(progressColor: string): string {
    const map: Record<string, string> = { green: '#10b981', orange: '#f59e0b', red: '#ef4444', blue: '#3b82f6' };
    return map[progressColor] ?? '#3b82f6';
  }

  projClientColor(client: string): string {
    const map: Record<string, string> = { 'GHJK': '#10b981', 'dfg': '#3b82f6', 'eeeeee': '#8b5cf6' };
    if (map[client]) return map[client];
    const palette = ['#10b981', '#3b82f6', '#8b5cf6', '#f59e0b', '#ef4444'];
    let h = 0;
    for (let i = 0; i < client.length; i++) h = client.charCodeAt(i) + ((h << 5) - h);
    return palette[Math.abs(h) % palette.length];
  }

  collabProgressColor(statusClass: string): string {
    return statusClass === 'occupied' ? '#f59e0b' : '#3b82f6';
  }

  scoreColor(score: number): string {
    return score >= 20 ? '#f59e0b' : '#ef4444';
  }

  projectInitials(name: string): string {
    if (!name) return 'PR';
    const parts = name.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return `${parts[0][0] ?? ''}${parts[1][0] ?? ''}`.toUpperCase();
  }

  statusBadgeClass(statusClass: Projet['statusClass']): string {
    if (statusClass === 'active') return 'bg-blue-100 text-blue-700';
    if (statusClass === 'pending') return 'bg-slate-200 text-slate-700';
    return 'bg-emerald-100 text-emerald-700';
  }

  resourceStatusClass(statusClass: Collaborateur['statusClass']): string {
    if (statusClass === 'occupied') return 'bg-amber-100 text-amber-700';
    return 'bg-emerald-100 text-emerald-700';
  }

  openAssistantChat(): void {
    this.chatbotService.openChat();
  }
}
