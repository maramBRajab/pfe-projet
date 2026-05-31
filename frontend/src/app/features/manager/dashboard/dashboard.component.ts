import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule, DatePipe }        from '@angular/common';
import { Router, RouterLink }             from '@angular/router';
import { Subject }                        from 'rxjs';
import { catchError, of }                 from 'rxjs';
import { ManagerShellComponent }          from '../shared/manager-shell.component';
import { Affectation, AffectationService, ProjetService, Projet as ApiProjet } from '../../../services/manager';

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

// ─── Component ───────────────────────────────────────────────

@Component({
  selector:    'app-manager-dashboard',
  templateUrl: './dashboard.component.html',
  styleUrls:   ['./dashboard.component.scss'],
  standalone:  true,
  imports:     [CommonModule, DatePipe, RouterLink],
})
export class ManagerDashboardComponent implements OnInit, OnDestroy {

  private destroy$ = new Subject<void>();

  currentDate    = new Date();
  lastUpdated    = new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  isFluxMaitrise = true;
  userMenuOpen   = false;
  historyFilter: 'all' | 'month' | 'modified' = 'all';

  // ── KPI Cards ─────────────────────────────────────────────
  kpiCards: KpiCard[] = [
    { label: 'PROJETS ACTIFS',        value: 3,     sub: '2 prioritaire(s)',               badge: 'Pilotage', badgeType: 'pilotage', icon: 'folder',         color: 'blue',   valueColor: 'blue',   type: 'primary'   },
    { label: 'RESSOURCES DISPONIBLES',value: 2,     sub: 'sur 3 collaborateurs',           badge: 'Stable',   badgeType: 'stable',   icon: 'users',          color: 'green',  valueColor: 'green',  type: 'secondary' },
    { label: 'AFFECTATIONS EN COURS', value: 6,     sub: 'pilotage des engagements',        badge: 'Pilotage', badgeType: 'pilotage', icon: 'arrow-right',    color: 'orange', valueColor: 'orange', type: 'primary'   },
    { label: 'TAUX D\'AFFECTATION',   value: '67%', sub: 'Cible recommandée : 72%',         badge: 'Vigilance',badgeType: 'warning',  icon: 'activity',       color: 'purple', valueColor: 'purple', type: 'primary'   },
    { label: 'ALERTES PRIORITAIRES',  value: 1,     sub: '1 alerte(s) active(s)',           badge: 'Pilotage', badgeType: 'pilotage', icon: 'alert-triangle', color: 'red',    valueColor: 'default',type: 'warning'   },
    { label: 'COMPATIBILITÉ IA',      value: '51%', sub: 'score moyen recommandations',     badge: 'IA',       badgeType: 'ai',       icon: 'cpu',            color: 'cyan',   valueColor: 'muted',  type: 'ai'        },
  ];

  // ── Projets ───────────────────────────────────────────────
  projets: Projet[] = [];

  // ── Collaborateurs ────────────────────────────────────────
  collaborateurs: Collaborateur[] = [
    { id: 'c1', name: 'Collaborateur Demo', initials: 'CD', role: 'Consultant technique', color: '#10b981', loadPercent: 72, loadClass: 'medium', status: 'Occupé',     statusClass: 'occupied',  projectCount: 2 },
    { id: 'c2', name: 'maram ben rajab',    initials: 'MB', role: 'Consultant technique', color: '#ef4444', loadPercent: 68, loadClass: 'medium', status: 'Disponible', statusClass: 'available', projectCount: 2 },
    { id: 'c3', name: 'Nour Ghorbel',       initials: 'NG', role: 'Consultant technique', color: '#10b981', loadPercent: 66, loadClass: 'medium', status: 'Disponible', statusClass: 'available', projectCount: 2 },
  ];

  // ── Recommandations ───────────────────────────────────────
  recommandations: Recommandation[] = [];

  // ── Alertes ───────────────────────────────────────────────
  alertes: Alerte[] = [];

  // ── Affectations ──────────────────────────────────────────
  affectations: HistoriqueAffectation[] = [
    { id: 1, collaborateurNom: 'Collaborateur Demo', collaborateurInit: 'CD', collaborateurColor: '#10b981', projet: 'DSN',    profil: 'Consultant technique', score: 20, date: new Date('2026-04-20') },
    { id: 2, collaborateurNom: 'maram ben rajab',    collaborateurInit: 'MB', collaborateurColor: '#ef4444', projet: 'DSN',    profil: 'Consultant technique', score: 10, date: new Date('2026-04-20') },
    { id: 3, collaborateurNom: 'Nour Ghorbel',       collaborateurInit: 'NG', collaborateurColor: '#10b981', projet: 'DSN',    profil: 'Consultant technique', score: 5,  date: new Date('2026-04-20') },
    { id: 4, collaborateurNom: 'maram ben rajab',    collaborateurInit: 'MB', collaborateurColor: '#ef4444', projet: 'azzeer', profil: 'Consultant technique', score: 10, date: new Date('2026-04-15') },
    { id: 5, collaborateurNom: 'Nour Ghorbel',       collaborateurInit: 'NG', collaborateurColor: '#10b981', projet: 'azzeer', profil: 'Consultant technique', score: 5,  date: new Date('2026-04-15') },
    { id: 6, collaborateurNom: 'Collaborateur Demo', collaborateurInit: 'CD', collaborateurColor: '#10b981', projet: 'azzeer', profil: 'Consultant technique', score: 20, date: new Date('2026-04-15') },
  ];

  get filteredHistory(): HistoriqueAffectation[] {
    const now = new Date();
    switch (this.historyFilter) {
      case 'month':    return this.affectations.filter(h => (now.getTime() - h.date.getTime()) / 86400000 <= 30);
      case 'modified': return this.affectations.filter(h => h.score > 15);
      default:         return this.affectations;
    }
  }

  constructor(private router: Router, private affectationService: AffectationService, private projetService: ProjetService) {}

  ngOnInit(): void {
    this.updateKpiCards();

    // Charger les vrais projets (les plus récents en premier)
    this.projetService.getAll().pipe(catchError(() => of([] as ApiProjet[]))).subscribe(list => {
      const sorted = [...list].sort((a, b) => (b.id ?? 0) - (a.id ?? 0)).slice(0, 5);
      this.projets = sorted.map(p => this.mapProjet(p));
      this.apiProjetsById = new Map(sorted.map(p => [`proj-${p.id}`, p]));
      this.refreshResourceCounts();
      this.recomputeAlertes();
      this.updateKpiCards();
    });

    this.affectationService.getAll().pipe(catchError(() => of([] as Affectation[]))).subscribe(list => {
      if (list.length) {
        this.affectations = list.map(a => ({
          id:                 a.id,
          collaborateurNom:   `${a.collaborateur.prenom} ${a.collaborateur.nom}`,
          collaborateurInit:  `${a.collaborateur.prenom?.[0] ?? ''}${a.collaborateur.nom?.[0] ?? ''}`.toUpperCase(),
          collaborateurColor: '#10b981',
          projet:             a.projet?.nom ?? '—',
          profil:             'Consultant',
          score:              a.score,
          date:               new Date(a.dateAffectation)
        }));
        this.rawAffectations = list;
        this.refreshResourceCounts();
        this.recomputeAlertes();
        this.updateKpiCards();
      }
    });
  }

  private rawAffectations: Affectation[] = [];

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

  private recomputeAlertes(): void {
    const alerts: Alerte[] = [];

    // Projets sans ressource affectée
    for (const p of this.projets) {
      if (p.resourceCount === 0 && p.statusClass !== 'paused') {
        const start = p.deadline; // fallback
        const projetApi = this.apiProjetsById.get(p.id);
        const dateDebut = projetApi ? new Date(projetApi.dateDebut) : start;
        const dStr = isNaN(dateDebut.getTime())
          ? '—'
          : dateDebut.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' });
        alerts.push({
          id: `np-${p.id}`,
          message: `${p.name} — aucune ressource`,
          sub: `Démarrage prévu le ${dStr}`,
          type: 'danger',
          actionUrl: `/manager/projets`
        });
      }
    }

    // Collaborateurs disponibles
    const dispos = this.collaborateurs.filter(c => c.statusClass === 'available').length;
    if (dispos > 0) {
      alerts.push({
        id: 'dispo',
        message: `${dispos} collaborateur${dispos > 1 ? 's' : ''} disponible${dispos > 1 ? 's' : ''} pour analyse IA`,
        sub: 'Lancer une recommandation pour les affecter',
        type: 'info',
        actionUrl: '/manager/affectation'
      });
    }

    this.alertes = alerts;
  }

  private apiProjetsById = new Map<string, ApiProjet>();

  private mapProjet(p: ApiProjet): Projet {
    const statut = (p.statut || '').toUpperCase();
    let status = p.statut || '—';
    let statusClass: 'pending' | 'active' | 'paused' | 'danger' = 'pending';
    if (statut.includes('COURS')) { status = 'En cours'; statusClass = 'active'; }
    else if (statut.includes('ATTENTE')) { status = 'En attente'; statusClass = 'pending'; }
    else if (statut.includes('TERMIN')) { status = 'Terminé'; statusClass = 'paused'; }

    const start = new Date(p.dateDebut).getTime();
    const end = new Date(p.dateFin).getTime();
    const now = Date.now();
    let progress = 0;
    if (end > start) {
      progress = Math.max(0, Math.min(100, Math.round(((now - start) / (end - start)) * 100)));
    }
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
    this.kpiCards[0].value = this.projets.filter(p => p.statusClass !== 'paused').length;
    this.kpiCards[0].sub   = `${this.projets.filter(p => p.statusClass === 'pending').length} prioritaire(s)`;
    this.kpiCards[1].value = this.collaborateurs.filter(c => c.statusClass === 'available').length;
    this.kpiCards[1].sub   = `sur ${this.collaborateurs.length} collaborateurs`;
    this.kpiCards[2].value = this.affectations.length;
    this.kpiCards[4].value = this.alertes.length;
    this.kpiCards[4].sub   = this.alertes.length === 0 ? 'aucune alerte critique' : `${this.alertes.length} alerte(s) active(s)`;
    const scores = this.recommandations.map(r => r.score);
    if (scores.length) {
      const avg = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
      this.kpiCards[5].value = `${avg}%`;
    }
  }

  // ── Navigation & actions ──────────────────────────────────
  refresh(): void                              { this.updateKpiCards(); this.lastUpdated = new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }); }
  refreshData(): void                          { this.refresh(); }
  toggleUserMenu(): void                       { this.userMenuOpen = !this.userMenuOpen; }
  navigateTo(path: string): void               { this.userMenuOpen = false; this.router.navigate([path]); }
  logout(): void                               { this.userMenuOpen = false; this.router.navigate(['/login']); }
  openNewProject(): void                       { this.router.navigate(['/manager/projets/nouveau']); }
  viewAllProjects(): void                      { this.router.navigate(['/manager/projets']); }

  editProject(p: Projet): void                { this.router.navigate(['/manager/projets/edit', p.id]); }
  viewAffectations(p: Projet): void           { this.router.navigate(['/manager/affectations'], { queryParams: { project: p.id } }); }
  assignCollaborator(p: Projet): void         { this.router.navigate(['/manager/affectations/new'], { queryParams: { project: p.id } }); }
  deleteProject(p: Projet): void {
    if (confirm(`Supprimer le projet "${p.name}" ?`)) {
      this.projets = this.projets.filter(x => x.id !== p.id);
      this.updateKpiCards();
    }
  }

  viewCollaboratorProfile(c: Collaborateur): void { this.router.navigate(['/manager/collaborateurs', c.id]); }
  assignToProject(c: Collaborateur): void         { this.router.navigate(['/manager/affectations/new'], { queryParams: { collaborateur: c.id } }); }
  viewFullAnalysis(): void                        { this.router.navigate(['/manager/charge-travail']); }

  openRecommendations(): void                      { this.router.navigate(['/manager/recommandations']); }
  applyRecommendation(r: Recommandation): void    { this.router.navigate(['/manager/affectations/new'], { queryParams: { collaborateur: r.collaborateurId, project: r.projetId } }); }
  dismissRecommendation(r: Recommandation): void  { this.recommandations = this.recommandations.filter(x => x.id !== r.id); this.updateKpiCards(); }

  openAlertAction(a: Alerte): void  { if (a.actionUrl) this.router.navigateByUrl(a.actionUrl); }
  dismissAlerte(a: Alerte): void    { this.alertes = this.alertes.filter(x => x.id !== a.id); this.updateKpiCards(); }

  setHistoryFilter(f: 'all' | 'month' | 'modified'): void { this.historyFilter = f; }
  openHistoryPage(): void                                   { this.router.navigate(['/manager/historique-affectations']); }
  editAffectation(e: HistoriqueAffectation): void          { this.router.navigate(['/manager/affectations', e.id, 'edit']); }
  cancelAffectation(e: HistoriqueAffectation): void {
    if (confirm(`Annuler l'affectation de ${e.collaborateurNom} sur ${e.projet} ?`)) {
      this.affectations = this.affectations.filter(x => x.id !== e.id);
      this.updateKpiCards();
    }
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
    const max = this.projets.length * this.collaborateurs.length;
    return max > 0 ? `${Math.round(this.affectations.length / max * 100)}%` : '0%';
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
}