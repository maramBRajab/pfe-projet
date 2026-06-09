import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule, DatePipe }        from '@angular/common';
import { Router }                         from '@angular/router';
import { Subject }                        from 'rxjs';
import { takeUntil }                      from 'rxjs/operators';

// ─── Interfaces ──────────────────────────────────────────────

export interface KpiCard {
  label: string;
  value: string | number;
  sub: string;
  badge: string;
  badgeType: 'pilotage' | 'stable' | 'warning' | 'danger' | 'ai' | 'neutral';
  icon: string;
  color: 'blue' | 'green' | 'orange' | 'purple' | 'red' | 'cyan';
  valueColor: 'blue' | 'green' | 'orange' | 'purple' | 'red' | 'default' | 'muted';
  type?: string;
}

export interface TeamMember {
  name: string;
  initials: string;
  color: string;
}

export interface Project {
  id: string;
  name: string;
  client: string;
  status: string;
  statusClass: 'pending' | 'active' | 'paused' | 'danger';
  resourceCount: number;
  deadline: Date;
  progress: number;
  progressColor: 'blue' | 'green' | 'orange' | 'red';
  team: TeamMember[];
  requiredSkills?: string[];
  description?: string;
}

export interface Collaborator {
  id: string;
  name: string;
  initials: string;
  role: string;
  color: string;
  loadPercent: number;
  loadClass: 'low' | 'medium' | 'high';
  status: string;
  statusClass: 'available' | 'occupied' | 'unavailable';
  projectCount: number;
  skills?: string[];
}

export interface Recommendation {
  id: string;
  collaborator: string;
  collaboratorId: string;
  project: string;
  projectId: string;
  score: number;
  matchingSkills: string[];
}

export interface Alert {
  id: string;
  message: string;
  sub: string;
  type: 'warning' | 'info' | 'success' | 'danger';
  actionUrl?: string;
}

export interface AffectationHistory {
  id: string;
  collaboratorName: string;
  collaboratorInitials: string;
  collaboratorColor: string;
  project: string;
  profile: string;
  score: number;
  date: Date;
}

// ─── Component ───────────────────────────────────────────────

@Component({
  selector:    'app-manager-dashboard',
  templateUrl: './dashboard.component.html',
  styleUrls:   ['./dashboard.component.scss'],
  standalone:  true,
  imports:     [CommonModule, DatePipe],
})
export class ManagerDashboardComponent implements OnInit, OnDestroy {

  private destroy$ = new Subject<void>();

  currentDate = new Date();
  isFluxMaitrise = true;
  historyFilter: 'all' | 'month' | 'modified' = 'all';

  // ── KPI Cards ─────────────────────────────────────────────
  kpiCards: KpiCard[] = [
    {
      label:      'PROJETS ACTIFS',
      value:      3,
      sub:        '1 prioritaire(s)',
      badge:      'Pilotage',
      badgeType:  'pilotage',
      icon:       'folder',
      color:      'blue',
      valueColor: 'blue',
    },
    {
      label:      'RESSOURCES DISPONIBLES',
      value:      3,
      sub:        'sur 3 collaborateurs',
      badge:      'Stable',
      badgeType:  'stable',
      icon:       'users',
      color:      'green',
      valueColor: 'green',
    },
    {
      label:      'AFFECTATIONS EN COURS',
      value:      6,
      sub:        'pilotage des engagements',
      badge:      'Pilotage',
      badgeType:  'pilotage',
      icon:       'arrow-right',
      color:      'orange',
      valueColor: 'orange',
    },
    {
      label:      'TAUX D\'AFFECTATION',
      value:      '200%',
      sub:        'mobilisation globale',
      badge:      'Pilotage',
      badgeType:  'pilotage',
      icon:       'activity',
      color:      'purple',
      valueColor: 'purple',
    },
    {
      label:      'ALERTES PRIORITAIRES',
      value:      0,
      sub:        'aucune alerte critique',
      badge:      'Pilotage',
      badgeType:  'pilotage',
      icon:       'alert-triangle',
      color:      'red',
      valueColor: 'default',
    },
    {
      label:      'COMPATIBILITÉ IA',
      value:      'N/A',
      sub:        'moyenne des recommandations',
      badge:      'IA',
      badgeType:  'ai',
      icon:       'cpu',
      color:      'cyan',
      valueColor: 'muted',
    },
  ];

  // ── Projects ──────────────────────────────────────────────
  projects: Project[] = [
    {
      id:            'proj-1',
      name:          'LINA',
      client:        'GHJK',
      status:        'EN ATTENTE',
      statusClass:   'pending',
      resourceCount: 0,
      deadline:      new Date('2026-04-12'),
      progress:      35,
      progressColor: 'blue',
      team:          [],
      requiredSkills: ['Angular', 'Node.js'],
      description:   'Projet en attente d\'affectation de ressources.',
    },
    {
      id:            'proj-2',
      name:          'DSN',
      client:        'dfg',
      status:        'EN ATTENTE',
      statusClass:   'pending',
      resourceCount: 3,
      deadline:      new Date('2026-04-24'),
      progress:      15,
      progressColor: 'red',
      team: [
        { name: 'Collaborateur Demo', initials: 'CD', color: '#2563eb' },
        { name: 'maram ben rajab',   initials: 'MB', color: '#dc2626' },
        { name: 'Nour Ghorbel',      initials: 'NG', color: '#0891b2' },
      ],
      requiredSkills: ['Java', 'Spring Boot'],
    },
    {
      id:            'proj-3',
      name:          'azzeer',
      client:        'eeeeee',
      status:        'EN COURS',
      statusClass:   'active',
      resourceCount: 3,
      deadline:      new Date('2026-07-12'),
      progress:      60,
      progressColor: 'green',
      team: [
        { name: 'maram ben rajab',   initials: 'MB', color: '#dc2626' },
        { name: 'Nour Ghorbel',      initials: 'NG', color: '#0891b2' },
        { name: 'Collaborateur Demo', initials: 'CD', color: '#2563eb' },
      ],
    },
  ];

  // ── Collaborators ─────────────────────────────────────────
  collaborators: Collaborator[] = [
    {
      id:           'collab-1',
      name:         'Collaborateur Demo',
      initials:     'CD',
      role:         'Consultant technique',
      color:        '#2563eb',
      loadPercent:  72,
      loadClass:    'medium',
      status:       'Occupé',
      statusClass:  'occupied',
      projectCount: 2,
      skills:       ['Angular', 'Node.js', 'TypeScript'],
    },
    {
      id:           'collab-2',
      name:         'maram ben rajab',
      initials:     'MB',
      role:         'Consultant technique',
      color:        '#dc2626',
      loadPercent:  68,
      loadClass:    'medium',
      status:       'Disponible',
      statusClass:  'available',
      projectCount: 2,
      skills:       ['Java', 'Spring Boot', 'REST API'],
    },
    {
      id:           'collab-3',
      name:         'Nour Ghorbel',
      initials:     'NG',
      role:         'Consultant technique',
      color:        '#0891b2',
      loadPercent:  66,
      loadClass:    'medium',
      status:       'Disponible',
      statusClass:  'available',
      projectCount: 2,
      skills:       ['React', 'Python', 'Data Analysis'],
    },
  ];

  // ── Recommendations ───────────────────────────────────────
  recommendations: Recommendation[] = [];

  // ── Alerts ────────────────────────────────────────────────
  alerts: Alert[] = [
    {
      id:        'alert-1',
      message:   'azzeer suit une cadence conforme',
      sub:       'azzeer - Suivi opérationnel',
      type:      'info',
      actionUrl: '/manager/projets/proj-3',
    },
  ];

  // ── Assignment History ─────────────────────────────────────
  affectationHistory: AffectationHistory[] = [
    {
      id:                   'aff-1',
      collaboratorName:     'Collaborateur Demo',
      collaboratorInitials: 'CD',
      collaboratorColor:    '#2563eb',
      project:              'DSN',
      profile:              'Consultant technique',
      score:                20,
      date:                 new Date('2026-04-20'),
    },
    {
      id:                   'aff-2',
      collaboratorName:     'maram ben rajab',
      collaboratorInitials: 'MB',
      collaboratorColor:    '#dc2626',
      project:              'DSN',
      profile:              'Consultant technique',
      score:                10,
      date:                 new Date('2026-04-20'),
    },
    {
      id:                   'aff-3',
      collaboratorName:     'Nour Ghorbel',
      collaboratorInitials: 'NG',
      collaboratorColor:    '#0891b2',
      project:              'DSN',
      profile:              'Consultant technique',
      score:                5,
      date:                 new Date('2026-04-20'),
    },
    {
      id:                   'aff-4',
      collaboratorName:     'maram ben rajab',
      collaboratorInitials: 'MB',
      collaboratorColor:    '#dc2626',
      project:              'azzeer',
      profile:              'Consultant technique',
      score:                10,
      date:                 new Date('2026-04-15'),
    },
    {
      id:                   'aff-5',
      collaboratorName:     'Nour Ghorbel',
      collaboratorInitials: 'NG',
      collaboratorColor:    '#0891b2',
      project:              'azzeer',
      profile:              'Consultant technique',
      score:                5,
      date:                 new Date('2026-04-15'),
    },
    {
      id:                   'aff-6',
      collaboratorName:     'Collaborateur Demo',
      collaboratorInitials: 'CD',
      collaboratorColor:    '#2563eb',
      project:              'azzeer',
      profile:              'Consultant technique',
      score:                20,
      date:                 new Date('2026-04-15'),
    },
  ];

  get filteredHistory(): AffectationHistory[] {
    const now = new Date();
    switch (this.historyFilter) {
      case 'month':
        return this.affectationHistory.filter(h => {
          const diff = (now.getTime() - h.date.getTime()) / (1000 * 60 * 60 * 24);
          return diff <= 30;
        });
      case 'modified':
        return this.affectationHistory.filter(h => h.score > 15);
      default:
        return this.affectationHistory;
    }
  }

  constructor(private router: Router) {}

  ngOnInit(): void {
    this.updateKpiCards();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // ── KPI calculation ───────────────────────────────────────
  private updateKpiCards(): void {
    const activeProjects   = this.projects.filter(p => p.statusClass !== 'paused').length;
    const priorityProjects = this.projects.filter(p => p.statusClass === 'pending').length;
    const availableCollabs = this.collaborators.filter(c => c.statusClass === 'available').length;
    const totalAffectations = this.affectationHistory.length;
    const aiScores         = this.recommendations.map(r => r.score);
    const avgAI            = aiScores.length ? Math.round(aiScores.reduce((a, b) => a + b, 0) / aiScores.length) : null;

    this.kpiCards[0].value = activeProjects;
    this.kpiCards[0].sub   = `${priorityProjects} prioritaire(s)`;

    this.kpiCards[1].value = availableCollabs;
    this.kpiCards[1].sub   = `sur ${this.collaborators.length} collaborateurs`;

    this.kpiCards[2].value = totalAffectations;

    this.kpiCards[4].value = this.alerts.length;
    this.kpiCards[4].sub   = this.alerts.length === 0 ? 'aucune alerte critique' : `${this.alerts.length} alerte(s) active(s)`;

    this.kpiCards[5].value = avgAI !== null ? `${avgAI}%` : 'N/A';
    this.kpiCards[5].sub   = avgAI !== null ? 'moyenne des recommandations' : 'aucune recommandation active';
  }

  // ── Navigation ────────────────────────────────────────────
  refreshData(): void {
    this.updateKpiCards();
    // TODO: dispatch store refresh action or call service
  }

  openNewProject(): void {
    this.router.navigate(['/manager/projets/nouveau']);
  }

  viewAllProjects(): void {
    this.router.navigate(['/manager/projets']);
  }

  editProject(project: Project): void {
    this.router.navigate(['/manager/projets', project.id, 'edit']);
  }

  viewAffectations(project: Project): void {
    this.router.navigate(['/manager/affectations-en-cours'], { queryParams: { project: project.id } });
  }

  deleteProject(project: Project): void {
    this.projects = this.projects.filter(p => p.id !== project.id);
    this.updateKpiCards();
  }

  assignCollaborator(project: Project): void {
    this.router.navigate(['/manager/affectations/nouveau'], { queryParams: { project: project.id } });
  }

  // ── Collaborator actions ──────────────────────────────────
  viewCollaboratorProfile(collab: Collaborator): void {
    this.router.navigate(['/manager/collaborateurs', collab.id]);
  }

  assignToProject(collab: Collaborator): void {
    this.router.navigate(['/manager/affectations/nouveau'], { queryParams: { collaborateur: collab.id } });
  }

  viewFullAnalysis(): void {
    this.router.navigate(['/manager/charge-de-travail']);
  }

  // ── Recommendations ───────────────────────────────────────
  openRecommendations(): void {
    this.router.navigate(['/manager/recommandations']);
  }

  applyRecommendation(rec: Recommendation): void {
    this.router.navigate(['/manager/affectations/nouveau'], {
      queryParams: { collaborateur: rec.collaboratorId, project: rec.projectId },
    });
  }

  dismissRecommendation(rec: Recommendation): void {
    this.recommendations = this.recommendations.filter(r => r.id !== rec.id);
    this.updateKpiCards();
  }

  // ── Alerts ────────────────────────────────────────────────
  openAlertAction(alert: Alert): void {
    if (alert.actionUrl) this.router.navigateByUrl(alert.actionUrl);
  }

  dismissAlert(alert: Alert): void {
    this.alerts = this.alerts.filter(a => a.id !== alert.id);
    this.updateKpiCards();
  }

  // ── History ───────────────────────────────────────────────
  setHistoryFilter(filter: 'all' | 'month' | 'modified'): void {
    this.historyFilter = filter;
  }

  openHistoryPage(): void {
    this.router.navigate(['/manager/affectations/historique']);
  }

  editAffectation(entry: AffectationHistory): void {
    this.router.navigate(['/manager/affectations', entry.id, 'edit']);
  }

  cancelAffectation(entry: AffectationHistory): void {
    this.affectationHistory = this.affectationHistory.filter(h => h.id !== entry.id);
    this.updateKpiCards();
  }

  // ── Helpers ───────────────────────────────────────────────
  getProjectBorderColor(status: string): string {
    switch (status) {
      case 'EN ATTENTE': return 'yellow';
      case 'EN COURS':   return 'green';
      case 'TERMINÉ':    return 'gray';
      case 'EN RETARD':  return 'red';
      default:           return 'gray';
    }
  }

  getScoreClass(score: number): 'high' | 'medium' | 'low' {
    if (score >= 70) return 'high';
    if (score >= 40) return 'medium';
    return 'low';
  }
}
