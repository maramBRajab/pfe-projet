import { CommonModule } from '@angular/common';
import { Component, ElementRef, HostListener, OnDestroy, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { catchError, forkJoin, of } from 'rxjs';
import { AdminSidebarComponent } from '../shared/admin-sidebar.component';
import { AdminNotificationsPanelService } from '../shared/admin-notifications-panel.service';
import { AuthService } from '../../../services/auth';

import {
  Activite,
  AdminDashboardService,
  Alerte,
  Collaborateur,
  DashboardInsights,
  DashboardStats,
  EvolutionMois,
  Projet,
  RepartitionRoles
} from '../../../services/admin';

type TrendTone = 'positive' | 'negative' | 'neutral';
type RiskTone = 'good' | 'watch' | 'risk';

interface DashboardKpiCard {
  label: string;
  value: string;
  deltaLabel: string;
  deltaTone: TrendTone;
  hint: string;
}

interface HealthFactor {
  label: string;
  score: number;
  tone: RiskTone;
  detail: string;
}

interface PlatformHealth {
  score: number;
  label: string;
  summary: string;
  tone: RiskTone;
  factors: HealthFactor[];
}

interface CriticalProjectItem {
  id?: number;
  nom: string;
  manager: string;
  statut: string;
  charge: number;
  assignmentCount: number;
  averageScore: number;
  daysLeft: number;
  risk: string;
  recommendation: string;
  link: string;
  tone: RiskTone;
}

interface DeadlineItem {
  id?: number;
  nom: string;
  owner: string;
  dueLabel: string;
  daysLeft: number;
  tone: RiskTone;
  link: string;
}

interface CollaboratorLoadItem {
  id?: number;
  name: string;
  role: string;
  load: number;
  assignmentCount: number;
  activeProjects: number;
  availabilityLabel: string;
  skills: string;
  tone: RiskTone;
  link: string;
}

interface SearchResultItem {
  type: 'Projet' | 'Utilisateur';
  title: string;
  subtitle: string;
  link: string;
}

interface SuggestionItem {
  title: string;
  detail: string;
  actionLabel: string;
  link: string;
  tone: RiskTone;
}

interface TimelineGroup {
  label: string;
  items: Activite[];
}

@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, AdminSidebarComponent],
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.scss']
})
export class AdminDashboardComponent implements OnInit, OnDestroy {
  currentDate = new Date();
  lastUpdated = new Date();
  loading = true;
  pdfSuccess = false;
  searchTerm = '';
  searchResultsState: SearchResultItem[] = [];
  autoRefreshEnabled = false;
  darkMode = false;

  stats: DashboardStats = this.buildFallbackStats();

  evolutionData: EvolutionMois[] = [];
  maxBarValue = 1;

  repartition: RepartitionRoles = {
    collaborateurs: 0,
    managers:       0,
    admins:         0
  };

  alertes:         Alerte[]   = [];
  activiteRecente: Activite[] = [];
  projets: Projet[] = [];
  collaborateurs: Collaborateur[] = [];

  kpiCards: DashboardKpiCard[] = [];
  platformHealth: PlatformHealth = {
    score: 0,
    label: 'Initialisation',
    summary: 'Chargement des signaux de pilotage.',
    tone: 'watch',
    factors: []
  };
  criticalProjects: CriticalProjectItem[] = [];
  upcomingDeadlines: DeadlineItem[] = [];
  collaboratorLoad: CollaboratorLoadItem[] = [];
  suggestions: SuggestionItem[] = [];
  timelineGroups: TimelineGroup[] = [];

  private readonly CIRCUMFERENCE = 2 * Math.PI * 70;
  private readonly autoRefreshMs = 60_000;
  private autoRefreshHandle?: number;

  userMenuOpen = false;
  /** Controls the slide-out recommendations panel */
  showRecommendationsPanel = false;

  // Filter state for Portefeuille sous tension
  activeFilter: string = 'tous';

  get filteredProjects() {
    if (this.activeFilter === 'retard') {
      return this.criticalProjects.filter(p => p.daysLeft < 0);
    }
    if (this.activeFilter === 'cours') {
      return this.criticalProjects.filter(
        p => p.daysLeft >= 0
      );
    }
    return this.criticalProjects;
  }

  setFilter(filter: string): void {
    this.activeFilter = filter;
  }

  constructor(
    private readonly dashboardService: AdminDashboardService,
    private readonly notificationsPanel: AdminNotificationsPanelService,
    private readonly authService: AuthService,
    private readonly router: Router,
    private readonly elRef: ElementRef
  ) {}

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (!this.elRef.nativeElement.contains(event.target)) {
      this.userMenuOpen = false;
    }
  }

  toggleUserMenu(): void {
    this.userMenuOpen = !this.userMenuOpen;
  }

  navigateTo(path: string): void {
    this.userMenuOpen = false;
    void this.router.navigate([path]);
  }

  logout(): void {
    this.userMenuOpen = false;
    this.authService.logout();
    void this.router.navigate(['/login']);
  }

  openNotificationsPanel(): void {
    this.notificationsPanel.open();
  }

  openRecommendationsPanel(): void {
    this.showRecommendationsPanel = true;
  }

  closeRecommendationsPanel(): void {
    this.showRecommendationsPanel = false;
  }

  ngOnInit(): void {
    this.loadStats();
  }

  ngOnDestroy(): void {
    this.stopAutoRefresh();
  }

  loadStats(silent = false): void {
    if (!silent) {
      this.loading = true;
    }

    forkJoin({
      stats: this.dashboardService.getStats().pipe(catchError(() => of(this.buildFallbackStats()))),
      evolution: this.dashboardService.getEvolutionProjets().pipe(catchError(() => of(this.buildFallbackEvolution()))),
      repartition: this.dashboardService.getRepartitionRoles().pipe(catchError(() => of(this.buildFallbackRepartition()))),
      alertes: this.dashboardService.getAlertes().pipe(catchError(() => of(this.buildFallbackAlerts()))),
      activite: this.dashboardService.getActiviteRecente().pipe(catchError(() => of(this.buildFallbackActivities()))),
      insights: this.dashboardService.getInsights().pipe(catchError(() => of(this.buildFallbackInsights())))
    }).subscribe(({ stats, evolution, repartition, alertes, activite, insights }) => {
      this.stats = stats;
      this.evolutionData = evolution;
      this.maxBarValue = Math.max(
        ...evolution.map((entry) => Math.max(entry.actifs, entry.termines)),
        1
      );
      this.repartition = repartition;
      this.alertes = alertes;
      this.notificationsPanel.notificationCount.set(alertes.length);
      this.activiteRecente = activite;
      this.platformHealth = insights.platformHealth as PlatformHealth;
      this.criticalProjects = insights.criticalProjects as unknown as CriticalProjectItem[];
      this.upcomingDeadlines = insights.upcomingDeadlines as unknown as DeadlineItem[];
      this.collaboratorLoad = insights.collaboratorLoad as unknown as CollaboratorLoadItem[];
      this.suggestions = insights.suggestions as unknown as SuggestionItem[];
      this.timelineGroups = this.buildTimelineGroups();
      this.kpiCards = this.buildKpiCards();

      this.lastUpdated = new Date();
      this.currentDate = new Date();
      this.loading = false;
    });
  }

  onSearchChange(): void {
    const query = this.searchTerm.trim();

    if (query.length < 2) {
      this.searchResultsState = [];
      return;
    }

    this.dashboardService.search(query).pipe(
      catchError(() => of(this.buildFallbackSearchResults(query)))
    ).subscribe((results) => {
      this.searchResultsState = results as SearchResultItem[];
    });
  }

  toggleAutoRefresh(): void {
    this.autoRefreshEnabled = !this.autoRefreshEnabled;

    if (this.autoRefreshEnabled) {
      this.startAutoRefresh();
      this.loadStats(true);
      return;
    }

    this.stopAutoRefresh();
  }

  toggleDarkMode(): void {
    this.darkMode = !this.darkMode;
  }

  exportExcel(): void {
    const rows = [
      ['Bloc', 'Element', 'Valeur'],
      ['Santé', 'Score global', String(this.platformHealth.score)],
      ['Santé', 'Statut', this.platformHealth.label],
      ['KPI', 'Projets actifs', String(this.stats.projetsActifs)],
      ['KPI', 'Taux d\'affectation', `${this.stats.tauxAffectation}%`],
      ['KPI', 'Ressources disponibles', String(this.stats.ressourcesDisponibles)],
      ...this.criticalProjects.map((project) => ['Projet critique', project.nom, `${project.charge}%`]),
      ...this.upcomingDeadlines.map((deadline) => ['Deadline', deadline.nom, deadline.dueLabel]),
      ...this.collaboratorLoad.map((item) => ['Charge collaborateur', item.name, `${item.load}%`])
    ];

    const csv = rows
      .map((row) => row.map((cell) => this.escapeCsvCell(cell)).join(';'))
      .join('\n');

    this.downloadFile('dashboard-admin.csv', `\uFEFF${csv}`, 'text/csv;charset=utf-8;');
  }

  exportPdf(): void {
    this.loading = true;
    this.lastUpdated = new Date();
    this.stats = this.buildFallbackStats();
    this.platformHealth = this.buildFallbackInsights().platformHealth;
    this.criticalProjects = [];
    this.alertes = [];
    this.activiteRecente = [];
    this.kpiCards = [];

    this.loadStats();

    const printWindow = window.open('', '_blank', 'width=1100,height=760');

    if (!printWindow) {
      return;
    }

    printWindow.document.write(this.buildPrintableReport());
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();

    this.pdfSuccess = true;
    setTimeout(() => { this.pdfSuccess = false; }, 3000);
  }

  private get totalRepartition(): number {
    return this.repartition.collaborateurs + this.repartition.managers + this.repartition.admins;
  }

  getDonutDash(value: number): string {
    const total = this.totalRepartition;

    if (total === 0) {
      return `0 ${this.CIRCUMFERENCE}`;
    }

    const portion = (value / total) * this.CIRCUMFERENCE;
    return `${portion} ${this.CIRCUMFERENCE - portion}`;
  }

  getProjectTimingLabel(daysLeft: number): string {
    if (daysLeft < 0) {
      return `Retard ${Math.abs(daysLeft)}j`;
    }

    return `J-${daysLeft}`;
  }

  getDonutOffset(precedentValue: number): number {
    const total = this.totalRepartition;
    if (total === 0) return this.CIRCUMFERENCE / 4;
    return -((precedentValue / total) * this.CIRCUMFERENCE) + this.CIRCUMFERENCE / 4;
  }

  // Pourcentage pour les barres de légende (max = valeur la plus grande)
  getLegBarPct(value: number): number {
    const total = this.totalRepartition;
    if (total === 0) return 0;
    return Math.round((value / total) * 100);
  }

  getLinePoints(field: 'actifs' | 'termines'): string {
    if (!this.evolutionData.length) return '';
    const W = 400, H = 160, padX = 30, padY = 20;
    const n = this.evolutionData.length;
    return this.evolutionData.map((m, i) => {
      const x = n > 1 ? padX + (i / (n - 1)) * (W - 2 * padX) : W / 2;
      const rawVal = field === 'actifs' ? m.actifs : m.termines;
      const y = this.maxBarValue > 0
        ? (H - padY) - (rawVal / this.maxBarValue) * (H - 2 * padY)
        : H - padY;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    }).join(' ');
  }

  getLineDots(field: 'actifs' | 'termines'): { x: number; y: number; val: number }[] {
    if (!this.evolutionData.length) return [];
    const W = 400, H = 160, padX = 30, padY = 20;
    const n = this.evolutionData.length;
    return this.evolutionData.map((m, i) => {
      const x = n > 1 ? padX + (i / (n - 1)) * (W - 2 * padX) : W / 2;
      const rawVal = field === 'actifs' ? m.actifs : m.termines;
      const y = this.maxBarValue > 0
        ? (H - padY) - (rawVal / this.maxBarValue) * (H - 2 * padY)
        : H - padY;
      return { x, y, val: rawVal };
    });
  }

  /* Area fill polygon: line points + bottom-right + bottom-left corners */
  getAreaPoints(field: 'actifs' | 'termines'): string {
    const linePoints = this.getLinePoints(field);
    if (!linePoints) return '';
    const n = this.evolutionData.length;
    const W = 400, padX = 30, padY = 20, H = 160;
    const firstX = n > 1 ? padX : W / 2;
    const lastX  = n > 1 ? W - padX : W / 2;
    const bottomY = H - padY;
    return `${linePoints} ${lastX},${bottomY} ${firstX},${bottomY}`;
  }

  get urgentDeadlinesCount(): number {
    return this.upcomingDeadlines.filter((item) => item.daysLeft <= 7).length;
  }

  get overloadedCollaboratorsCount(): number {
    return this.collaboratorLoad.filter((item) => item.load >= 85).length;
  }

  get searchResults(): SearchResultItem[] {
    return this.searchResultsState;
  }

  get hasSearchQuery(): boolean {
    return this.searchTerm.trim().length > 0;
  }

  get lastUpdatedLabel(): string {
    return this.lastUpdated.toLocaleTimeString('fr-FR', {
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  private get availableResourcesCount(): number {
    return this.stats.ressourcesDisponibles;
  }

  private computeDecisionSupport(): void {
    this.collaboratorLoad = this.buildCollaboratorLoad();
    this.criticalProjects = this.buildCriticalProjects();
    this.upcomingDeadlines = this.buildUpcomingDeadlines();
    this.platformHealth = this.buildPlatformHealth();
    this.suggestions = this.buildSuggestions();
    this.timelineGroups = this.buildTimelineGroups();
    this.kpiCards = this.buildKpiCards();
  }

  private buildKpiCards(): DashboardKpiCard[] {
    const previousProjects = this.getPreviousEvolutionValue('actifs', this.stats.projetsActifs - this.stats.nouveauxProjets);
    const previousUsers = Math.max(this.stats.totalCollaborateurs - this.stats.nouveauxCollabs, 1);
    const previousAllocation = this.estimatePreviousAllocation();
    const previousDelayed = Math.max(0, this.stats.projetsEnRetard - 1);
    const previousAvailability = Math.max(1, this.stats.ressourcesDisponibles + Math.max(0, previousProjects - this.stats.projetsActifs));

    return [
      this.createKpiCard('Projets actifs', this.stats.projetsActifs, previousProjects, `${this.stats.nouveauxProjets} nouveaux ce mois`),
      this.createKpiCard('Utilisateurs', this.stats.totalCollaborateurs, previousUsers, `${this.stats.nouveauxCollabs} nouveaux profils`),
      this.createKpiCard('Taux d\'affectation', this.stats.tauxAffectation, previousAllocation, 'Cible recommandée: 72%', '%'),
      this.createKpiCard('Projets en retard', this.stats.projetsEnRetard, previousDelayed, 'Doit rester sous contrôle', '', true),
      this.createKpiCard('Ressources disponibles', this.stats.ressourcesDisponibles, previousAvailability, `${this.stats.ressourcesDisponibles} mobilisables rapidement`)
    ];
  }

  private createKpiCard(
    label: string,
    current: number,
    previous: number,
    hint: string,
    suffix = '',
    inverseGood = false
  ): DashboardKpiCard {
    const safePrevious = previous <= 0 ? Math.max(current, 1) : previous;
    const delta = Math.round(((current - safePrevious) / safePrevious) * 100);
    const effectiveDelta = inverseGood ? -delta : delta;

    return {
      label,
      value: `${current}${suffix}`,
      deltaLabel: `${delta > 0 ? '+' : ''}${delta}% vs période précédente`,
      deltaTone: effectiveDelta > 0 ? 'positive' : effectiveDelta < 0 ? 'negative' : 'neutral',
      hint
    };
  }

  private buildPlatformHealth(): PlatformHealth {
    const activeProjects = Math.max(this.stats.projetsActifs, 1);
    const delayedRatio = this.stats.projetsEnRetard / activeProjects;
    const availableRatio = this.availableResourcesCount / Math.max(this.stats.totalCollaborateurs, 1);
    const overloadedRatio = this.overloadedCollaboratorsCount / Math.max(this.collaboratorLoad.length, 1);
    const allocationGap = Math.abs(this.stats.tauxAffectation - 72);

    const deliveryScore = this.clamp(Math.round(100 - delayedRatio * 120), 0, 100);
    const allocationScore = this.clamp(Math.round(100 - allocationGap * 2.4), 0, 100);
    const capacityScore = this.clamp(Math.round(40 + availableRatio * 90), 0, 100);
    const balanceScore = this.clamp(Math.round(100 - overloadedRatio * 120), 0, 100);
    const score = Math.round(
      (deliveryScore * 0.35) +
      (allocationScore * 0.25) +
      (capacityScore * 0.20) +
      (balanceScore * 0.20)
    );

    return {
      score,
      label: this.resolveScoreTone(score) === 'good'
        ? 'Plateforme saine'
        : this.resolveScoreTone(score) === 'watch'
          ? 'Sous surveillance'
          : 'Attention prioritaire',
      summary: this.buildHealthSummary(score),
      tone: this.resolveScoreTone(score),
      factors: [
        {
          label: 'Exécution projet',
          score: deliveryScore,
          tone: this.resolveScoreTone(deliveryScore),
          detail: `${this.stats.projetsEnRetard} projet(s) en retard sur ${activeProjects}`
        },
        {
          label: 'Équilibre d\'affectation',
          score: allocationScore,
          tone: this.resolveScoreTone(allocationScore),
          detail: `${this.stats.tauxAffectation}% de mobilisation globale`
        },
        {
          label: 'Capacité disponible',
          score: capacityScore,
          tone: this.resolveScoreTone(capacityScore),
          detail: `${this.availableResourcesCount} ressource(s) rapidement activables`
        },
        {
          label: 'Charge collaborateurs',
          score: balanceScore,
          tone: this.resolveScoreTone(balanceScore),
          detail: `${this.overloadedCollaboratorsCount} surcharge(s) estimée(s)`
        }
      ]
    };
  }

  private buildCriticalProjects(): CriticalProjectItem[] {
    return this.projets
      .filter((project) => !this.isProjectCompleted(project.statut))
      .map((project, index) => {
        const daysLeft = this.getDaysLeft(project.dateFin);
        const charge = this.estimateProjectLoad(project, index);
        const tone = this.resolveOperationalTone(daysLeft, charge, this.normalizeStatus(project.statut) === 'en_retard');

        return {
          id: project.id,
          nom: project.nom,
          manager: project.managerNom?.trim() || 'Manager à confirmer',
          statut: this.formatProjectStatus(project.statut),
          charge,
          assignmentCount: Math.max(project.nombreCollabs ?? 0, 0),
          averageScore: Math.min(100, charge),
          daysLeft,
          risk: this.describeProjectRisk(project, daysLeft, charge),
          recommendation: this.buildProjectRecommendation(project, daysLeft, charge),
          link: this.resolveProjectLink(project.id),
          tone
        };
      })
      .filter((project) => project.tone !== 'good')
      .sort((first, second) => {
        if (first.tone !== second.tone) {
          return this.riskWeight(second.tone) - this.riskWeight(first.tone);
        }

        if (first.daysLeft !== second.daysLeft) {
          return first.daysLeft - second.daysLeft;
        }

        return second.charge - first.charge;
      })
      .slice(0, 4);
  }

  private buildUpcomingDeadlines(): DeadlineItem[] {
    return this.projets
      .filter((project) => !this.isProjectCompleted(project.statut))
      .map((project) => {
        const daysLeft = this.getDaysLeft(project.dateFin);
        const tone: RiskTone = daysLeft <= 3 ? 'risk' : daysLeft <= 10 ? 'watch' : 'good';

        return {
          id: project.id,
          nom: project.nom,
          owner: project.managerNom?.trim() || 'Manager à confirmer',
          dueLabel: this.formatDeadlineLabel(daysLeft),
          daysLeft,
          tone,
          link: this.resolveProjectLink(project.id)
        };
      })
      .sort((first, second) => first.daysLeft - second.daysLeft)
      .slice(0, 5);
  }

  private buildCollaboratorLoad(): CollaboratorLoadItem[] {
    const activeProjects = this.projets.filter((project) => !this.isProjectCompleted(project.statut)).length;

    return this.collaborateurs
      .map((collaborateur, index) => {
        const load = this.estimateCollaboratorLoad(collaborateur, index, activeProjects);
        const competences = (collaborateur.competences ?? []).map((competence) => competence.nom).filter(Boolean);
        const tone: RiskTone = load >= 85 ? 'risk' : load >= 65 ? 'watch' : 'good';

        return {
          id: collaborateur.id,
          name: `${collaborateur.prenom} ${collaborateur.nom}`.trim(),
          role: this.formatRole(collaborateur.role),
          load,
          assignmentCount: Math.max(1, Math.round(load / 35)),
          activeProjects: Math.max(1, Math.round((load / 100) * Math.max(activeProjects, 1))),
          availabilityLabel: collaborateur.disponible ? 'Disponible' : 'Occupé',
          skills: competences.slice(0, 3).join(' • ') || 'Compétences non renseignées',
          tone,
          link: this.resolveCollaboratorLink(collaborateur.id)
        };
      })
      .sort((first, second) => second.load - first.load)
      .slice(0, 6);
  }

  private buildSuggestions(): SuggestionItem[] {
    const suggestions: SuggestionItem[] = [];
    const urgentProjects = this.criticalProjects.filter((project) => project.tone === 'risk');
    const upcomingRisks = this.upcomingDeadlines.filter((deadline) => deadline.tone !== 'good');

    if (urgentProjects.length > 0 && this.availableResourcesCount > 0) {
      suggestions.push({
        title: 'Réallouer des ressources immédiatement',
        detail: `${this.availableResourcesCount} ressource(s) disponible(s) peuvent renforcer ${urgentProjects[0].nom}.`,
        actionLabel: 'Préparer une affectation',
        link: '/admin/affectation',
        tone: 'risk'
      });
    }

    if (this.overloadedCollaboratorsCount > 0) {
      suggestions.push({
        title: 'Rééquilibrer la charge collaborateurs',
        detail: `${this.overloadedCollaboratorsCount} collaborateur(s) dépassent la zone de charge recommandée.`,
        actionLabel: 'Voir les collaborateurs',
        link: '/admin/collaborateurs',
        tone: 'watch'
      });
    }

    if (upcomingRisks.length > 0) {
      suggestions.push({
        title: 'Lancer une revue deadlines à 7 jours',
        detail: `${upcomingRisks.length} échéance(s) approchent et demandent une revue planning.`,
        actionLabel: 'Ouvrir les projets',
        link: '/admin/projets',
        tone: 'watch'
      });
    }

    if (this.platformHealth.score < 70) {
      suggestions.push({
        title: 'Cadencer un point de pilotage hebdomadaire',
        detail: 'Le score global suggère une synchronisation plus courte entre staffing, délais et portefeuille.',
        actionLabel: 'Consulter le portefeuille',
        link: '/admin/dashboard',
        tone: 'risk'
      });
    }

    if (!suggestions.length) {
      suggestions.push({
        title: 'Maintenir le rythme actuel',
        detail: 'Les indicateurs sont maîtrisés. Le meilleur levier reste une revue quotidienne des deadlines et de la capacité.',
        actionLabel: 'Voir les projets',
        link: '/admin/projets',
        tone: 'good'
      });
    }

    return suggestions.slice(0, 4);
  }

  private buildTimelineGroups(): TimelineGroup[] {
    const groups: TimelineGroup[] = [
      { label: 'Aujourd’hui', items: [] },
      { label: 'Hier', items: [] },
      { label: 'Cette semaine', items: [] }
    ];

    this.activiteRecente.forEach((item, index) => {
      const target = this.resolveTimelineGroup(item.temps, index);
      const group = groups.find((entry) => entry.label === target);

      if (group) {
        group.items.push(item);
      }
    });

    return groups.filter((group) => group.items.length > 0);
  }

  private estimatePreviousAllocation(): number {
    const previousActiveProjects = this.getPreviousEvolutionValue('actifs', this.stats.projetsActifs);
    const currentActiveProjects = Math.max(this.stats.projetsActifs, 1);
    const estimated = Math.round((this.stats.tauxAffectation * previousActiveProjects) / currentActiveProjects);

    return this.clamp(estimated || this.stats.tauxAffectation, 0, 100);
  }

  private getPreviousEvolutionValue(metric: 'actifs' | 'termines', fallback: number): number {
    if (this.evolutionData.length < 2) {
      return Math.max(fallback, 1);
    }

    const previousEntry = this.evolutionData[this.evolutionData.length - 2];
    return Math.max(previousEntry[metric], 1);
  }

  private estimateProjectLoad(project: Projet, index: number): number {
    const status = this.normalizeStatus(project.statut);
    const daysLeft = this.getDaysLeft(project.dateFin);
    let load = status === 'en_retard'
      ? 90
      : status === 'en_pause'
        ? 58
        : status === 'en_attente'
          ? 52
          : 68;

    if (daysLeft <= 0) {
      load += 12;
    } else if (daysLeft <= 7) {
      load += 10;
    } else if (daysLeft <= 14) {
      load += 6;
    }

    if ((project.nombreCollabs ?? 0) <= 2) {
      load += 6;
    }

    load += index % 4;
    return this.clamp(load, 25, 100);
  }

  private estimateCollaboratorLoad(collaborateur: Collaborateur, index: number, activeProjects: number): number {
    const skillsCount = collaborateur.competences?.length ?? 0;
    const pressure = Math.round((activeProjects / Math.max(this.collaborateurs.length, 1)) * 35);
    let load = collaborateur.disponible ? 38 : 72;

    load += Math.min(collaborateur.experienceAnnees * 2, 16);
    load += Math.min(skillsCount * 4, 16);
    load += pressure;
    load += index % 6;

    return this.clamp(load, 20, 100);
  }

  private resolveOperationalTone(daysLeft: number, charge: number, delayed: boolean): RiskTone {
    if (delayed || charge >= 85 || daysLeft <= 3) {
      return 'risk';
    }

    if (charge >= 70 || daysLeft <= 10) {
      return 'watch';
    }

    return 'good';
  }

  private describeProjectRisk(project: Projet, daysLeft: number, charge: number): string {
    if (this.normalizeStatus(project.statut) === 'en_retard') {
      return 'Retard déclaré, arbitrage immédiat conseillé.';
    }

    if (daysLeft <= 3) {
      return 'Deadline très proche avec fenêtre de réaction courte.';
    }

    if (charge >= 85) {
      return 'Charge élevée, risque de saturation sur le delivery.';
    }

    return 'Projet à surveiller pour conserver le rythme.';
  }

  private buildProjectRecommendation(project: Projet, daysLeft: number, charge: number): string {
    if (daysLeft <= 3 || charge >= 90) {
      return `Renforcer ${project.nom} avec un renfort disponible et verrouiller le plan d'action.`;
    }

    if (daysLeft <= 10) {
      return 'Replanifier le backlog critique et confirmer les jalons avec le manager.';
    }

    return 'Maintenir une revue hebdomadaire des dépendances et de la capacité.';
  }

  private resolveTimelineGroup(timeLabel: string, index: number): string {
    const normalized = timeLabel.toLowerCase();

    if (normalized.includes('min') || normalized.includes('h') || normalized.includes('aujourd')) {
      return 'Aujourd’hui';
    }

    if (normalized.includes('hier')) {
      return 'Hier';
    }

    return index < 3 ? 'Aujourd’hui' : 'Cette semaine';
  }

  private buildHealthSummary(score: number): string {
    if (score >= 75) {
      return 'Les signaux sont solides. Le pilotage peut se concentrer sur les décisions d’optimisation et les arbitrages fins.';
    }

    if (score >= 55) {
      return 'La plateforme reste maîtrisable, mais les retards et la pression capacitaire appellent des arbitrages à court terme.';
    }

    return 'Le portefeuille montre des tensions structurelles. Le staffing et les échéances doivent être revus rapidement.';
  }

  private formatProjectStatus(status: string | undefined): string {
    const normalized = this.normalizeStatus(status);
    const labels: Record<string, string> = {
      en_attente: 'En attente',
      en_cours: 'En cours',
      termine: 'Terminé',
      en_pause: 'En pause',
      en_retard: 'En retard'
    };

    return labels[normalized] ?? 'À qualifier';
  }

  private formatRole(role: string | undefined): string {
    const normalized = (role ?? '').toUpperCase();

    if (normalized.includes('ADMIN')) {
      return 'Admin';
    }

    if (normalized.includes('MANAGER')) {
      return 'Manager';
    }

    return 'Collaborateur';
  }

  private normalizeStatus(status: string | undefined): string {
    return (status ?? '')
      .trim()
      .toLowerCase()
      .replace(/\s+/g, '_');
  }

  private isProjectCompleted(status: string | undefined): boolean {
    return this.normalizeStatus(status) === 'termine';
  }

  private getDaysLeft(dateValue: string): number {
    const date = new Date(dateValue);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    date.setHours(0, 0, 0, 0);

    return Math.round((date.getTime() - today.getTime()) / 86_400_000);
  }

  private formatDeadlineLabel(daysLeft: number): string {
    if (daysLeft < 0) {
      return `Retard de ${Math.abs(daysLeft)} j`;
    }

    if (daysLeft === 0) {
      return 'Aujourd’hui';
    }

    if (daysLeft === 1) {
      return 'Demain';
    }

    return `${daysLeft} jours`;
  }

  private resolveProjectLink(projectId?: number): string {
    return typeof projectId === 'number' ? `/admin/projets/edit/${projectId}` : '/admin/projets';
  }

  private resolveCollaboratorLink(collaboratorId?: number): string {
    return typeof collaboratorId === 'number' ? `/admin/collaborateurs/edit/${collaboratorId}` : '/admin/collaborateurs';
  }

  private riskWeight(tone: RiskTone): number {
    if (tone === 'risk') {
      return 3;
    }

    if (tone === 'watch') {
      return 2;
    }

    return 1;
  }

  private resolveScoreTone(score: number): RiskTone {
    if (score >= 75) {
      return 'good';
    }

    if (score >= 55) {
      return 'watch';
    }

    return 'risk';
  }

  private clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
  }

  private startAutoRefresh(): void {
    if (typeof window === 'undefined') {
      return;
    }

    this.stopAutoRefresh();
    this.autoRefreshHandle = window.setInterval(() => this.loadStats(true), this.autoRefreshMs);
  }

  private stopAutoRefresh(): void {
    if (typeof window === 'undefined' || typeof this.autoRefreshHandle !== 'number') {
      return;
    }

    window.clearInterval(this.autoRefreshHandle);
    this.autoRefreshHandle = undefined;
  }

  private escapeCsvCell(value: string): string {
    return `"${value.replace(/"/g, '""')}"`;
  }

  private downloadFile(filename: string, content: string, mimeType: string): void {
    if (typeof document === 'undefined') {
      return;
    }

    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  private buildPrintableReport(): string {
    const criticalRows = this.criticalProjects
      .map((project) => `<tr><td>${this.escapeHtml(project.nom)}</td><td>${this.escapeHtml(project.statut)}</td><td>${project.charge}%</td><td>${this.escapeHtml(project.risk)}</td></tr>`)
      .join('');

    const collaboratorRows = this.collaboratorLoad
      .map((item) => `<tr><td>${this.escapeHtml(item.name)}</td><td>${this.escapeHtml(item.role)}</td><td>${item.load}%</td><td>${this.escapeHtml(item.availabilityLabel)}</td></tr>`)
      .join('');

    return `
      <html>
        <head>
          <title>Rapport dashboard admin</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 32px; color: #0A1F3D; }
            h1, h2 { margin-bottom: 12px; }
            .meta { margin-bottom: 24px; color: #4A6B8A; }
            .score { font-size: 42px; font-weight: 700; margin-bottom: 8px; }
            table { width: 100%; border-collapse: collapse; margin-top: 12px; }
            th, td { border: 1px solid #d7e4f1; padding: 10px; font-size: 12px; text-align: left; }
            th { background: #eef5fb; }
          </style>
        </head>
        <body>
          <h1>Dashboard admin - Rapport de pilotage</h1>
          <div class="meta">Export du ${this.escapeHtml(new Date().toLocaleString('fr-FR'))}</div>
          <div class="score">${this.platformHealth.score}/100</div>
          <p>${this.escapeHtml(this.platformHealth.summary)}</p>
          <h2>Projets critiques</h2>
          <table>
            <thead><tr><th>Projet</th><th>Statut</th><th>Charge</th><th>Risque</th></tr></thead>
            <tbody>${criticalRows}</tbody>
          </table>
          <h2>Charge collaborateurs</h2>
          <table>
            <thead><tr><th>Collaborateur</th><th>Rôle</th><th>Charge</th><th>Disponibilité</th></tr></thead>
            <tbody>${collaboratorRows}</tbody>
          </table>
        </body>
      </html>
    `;
  }

  private escapeHtml(value: string): string {
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  private buildFallbackStats(): DashboardStats {
    return {
      projetsActifs: 3,
      totalCollaborateurs: 11,
      tauxAffectation: 27,
      managersActifs: 5,
      totalManagers: 5,
      projetsEnRetard: 0,
      ressourcesDisponibles: 9,
      nouveauxProjets: 4,
      nouveauxCollabs: 8,
    };
  }

  private buildFallbackEvolution(): EvolutionMois[] {
    return [
      { mois: 'Nov', actifs: 7,  termines: 2 },
      { mois: 'Déc', actifs: 9,  termines: 4 },
      { mois: 'Jan', actifs: 11, termines: 5 },
      { mois: 'Fév', actifs: 12, termines: 6 },
      { mois: 'Mar', actifs: 13, termines: 8 },
      { mois: 'Avr', actifs: 14, termines: 9 },
    ];
  }

  private buildFallbackRepartition(): RepartitionRoles {
    return { collaborateurs: 6, managers: 5, admins: 2 };
  }

  private buildFallbackAlerts(): Alerte[] {
    return [
      { type: 'warning', icon: '', message: '8 collaborateurs sans affectation',            time: 'Aucun projet assigné depuis plus de 7 jours' },
      { type: 'info',    icon: '', message: '2 ressources actuellement indisponibles',       time: 'Disponibilité incertaine cette semaine' },
      { type: 'ok',      icon: '', message: '0 projet en retard',                             time: 'Tous les jalons sont dans les délais' },
    ];
  }

  private buildFallbackActivities(): Activite[] {
    return [
      { initiales: 'A',  action: "Projet 'abccn' planifié",                                            temps: "\u00e0 l'instant", categorie: 'plan'  },
      { initiales: 'F',  action: "Projet 'frgtyjukinhbvg' planifié",                                   temps: 'il y a 12h',    categorie: 'projet' },
      { initiales: 'MB', action: 'Affectation mise \u00e0 jour\u00a0: mouadh bibeni \u2192 bbbp',                    temps: 'il y a 19h',    categorie: 'collab' },
      { initiales: 'NB', action: 'Affectation mise \u00e0 jour\u00a0: nour ben romdhane \u2192 frgtyjukinhbvg',     temps: 'il y a 20h',    categorie: 'admin'  },
    ];
  }

  private buildFallbackInsights(): DashboardInsights {
    return {
      platformHealth: {
        score: 95,
        label: 'Plateforme saine',
        summary: 'Les signaux sont solides. Le pilotage peut se concentrer sur les décisions d\u2019optimisation et les arbitrages fins.',
        tone: 'good',
        factors: [
          { label: 'Exécution projet',       score: 64, tone: 'watch', detail: '3 projet(s) en retard sur 14 actifs' },
          { label: 'Deadlines proches',      score: 58, tone: 'watch', detail: '3 échéance(s) sous 7 jours' },
          { label: 'Taux d’affectation', score: 76, tone: 'good',  detail: '76% de mobilisation globale' },
          { label: 'Capacité disponible',    score: 71, tone: 'watch', detail: '11 ressource(s) mobilisable(s)' }
        ]
      },
      criticalProjects: [
        {
          id: 101,
          nom: 'Programme CRM 360',
          manager: 'Sana Ben Ali',
          statut: 'En retard',
          charge: 91,
          assignmentCount: 2,
          averageScore: 88,
          daysLeft: -4,
          risk: 'Retard constaté — action immédiate recommandée.',
          recommendation: 'Réallouer des ressources et verrouiller un plan de rattrapage.',
          link: '/admin/projets/edit/101',
          tone: 'risk'
        },
        {
          id: 104,
          nom: 'Sprint Data Quality',
          manager: 'Nader Gharbi',
          statut: 'En pause',
          charge: 78,
          assignmentCount: 1,
          averageScore: 74,
          daysLeft: 2,
          risk: 'Deadline dans 2 jours, projet suspendu.',
          recommendation: 'Reprendre les travaux ou repousser le jalon après validation direction.',
          link: '/admin/projets/edit/104',
          tone: 'risk'
        },
        {
          id: 102,
          nom: 'Portail RH',
          manager: 'Karim Trabelsi',
          statut: 'En cours',
          charge: 72,
          assignmentCount: 3,
          averageScore: 68,
          daysLeft: 9,
          risk: 'Charge élevée, risque de dérapage si la capacité diminue.',
          recommendation: 'Replanifier le backlog critique et confirmer les jalons.',
          link: '/admin/projets/edit/102',
          tone: 'watch'
        },
        {
          id: 103,
          nom: 'App Mobile Client',
          manager: 'Leila Ben Amor',
          statut: 'En cours',
          charge: 65,
          assignmentCount: 4,
          averageScore: 62,
          daysLeft: 16,
          risk: 'Suivi régulier conseillé pour maintenir le rythme.',
          recommendation: 'Maintenir une revue hebdomadaire des dépendances.',
          link: '/admin/projets/edit/103',
          tone: 'watch'
        }
      ],
      upcomingDeadlines: [
        { id: 101, nom: 'Programme CRM 360',  owner: 'Sana Ben Ali',    dueLabel: 'Retard 4j',  daysLeft: -4, tone: 'risk',  link: '/admin/projets/edit/101' },
        { id: 104, nom: 'Sprint Data Quality', owner: 'Nader Gharbi',   dueLabel: '2 jours',    daysLeft: 2,  tone: 'risk',  link: '/admin/projets/edit/104' },
        { id: 102, nom: 'Portail RH',          owner: 'Karim Trabelsi', dueLabel: '9 jours',    daysLeft: 9,  tone: 'watch', link: '/admin/projets/edit/102' },
        { id: 106, nom: 'Audit Sécurité Q2',   owner: 'Ines Mzoughi',   dueLabel: '12 jours',   daysLeft: 12, tone: 'watch', link: '/admin/projets/edit/106' },
        { id: 103, nom: 'App Mobile Client',   owner: 'Leila Ben Amor', dueLabel: '16 jours',   daysLeft: 16, tone: 'good',  link: '/admin/projets/edit/103' }
      ],
      collaboratorLoad: [
        { id: 11, name: 'Malek Amari',    role: 'Collaborateur', load: 92, assignmentCount: 3, activeProjects: 3, availabilityLabel: 'Surchargé',    skills: 'Angular • UX • Testing',     tone: 'risk',  link: '/admin/collaborateurs/edit/11' },
        { id: 14, name: 'Nader Gharbi',   role: 'Collaborateur', load: 85, assignmentCount: 2, activeProjects: 2, availabilityLabel: 'Occupé',        skills: 'Data • SQL • ETL',            tone: 'risk',  link: '/admin/collaborateurs/edit/14' },
        { id: 12, name: 'Leila Ben Amor', role: 'Manager',       load: 74, assignmentCount: 2, activeProjects: 2, availabilityLabel: 'Occupé',        skills: 'Pilotage • CRM',              tone: 'watch', link: '/admin/collaborateurs/edit/12' },
        { id: 13, name: 'Karim Trabelsi', role: 'Manager',       load: 68, assignmentCount: 2, activeProjects: 2, availabilityLabel: 'Occupé',        skills: 'PMO • Reporting',             tone: 'watch', link: '/admin/collaborateurs/edit/13' },
        { id: 15, name: 'Ines Mzoughi',   role: 'Manager',       load: 45, assignmentCount: 1, activeProjects: 1, availabilityLabel: 'Disponible',    skills: 'BI • Agile • Audit',          tone: 'good',  link: '/admin/collaborateurs/edit/15' },
        { id: 16, name: 'Rania Slimi',    role: 'Manager',       load: 30, assignmentCount: 1, activeProjects: 1, availabilityLabel: 'Disponible',    skills: 'PMO • Agile • SCRUM',         tone: 'good',  link: '/admin/collaborateurs/edit/16' }
      ],
      suggestions: [
        {
          title: 'Réallouer des ressources sur CRM 360',
          detail: '2 ressources disponibles peuvent renforcer le projet le plus critique avant la deadline.',
          actionLabel: 'Ouvrir les affectations',
          link: '/admin/affectation',
          tone: 'risk'
        },
        {
          title: 'Rééquilibrer la charge Malek Amari',
          detail: 'Charge à 92% — risque de dérapage si une nouvelle affectation est ajoutée.',
          actionLabel: 'Voir le collaborateur',
          link: '/admin/collaborateurs/edit/11',
          tone: 'risk'
        },
        {
          title: 'Lancer une revue deadlines à 7 jours',
          detail: '3 échéances approchent et demandent une revue planning avec les managers.',
          actionLabel: 'Ouvrir les projets',
          link: '/admin/projets',
          tone: 'watch'
        },
        {
          title: 'Activer Rania Slimi sur un projet en attente',
          detail: 'Manager disponible (30% de charge) — idéal pour absorber un nouveau projet ou renforcer le portefeuille.',
          actionLabel: 'Créer une affectation',
          link: '/admin/affectation',
          tone: 'good'
        }
      ]
    };
  }
  private buildFallbackSearchResults(query: string): SearchResultItem[] {
    const normalized = query.toLowerCase();
    const fallback: SearchResultItem[] = [
      {
        type: 'Projet',
        title: 'Programme CRM 360',
        subtitle: 'En retard • echeance 2 jours',
        link: '/admin/projets/edit/101'
      },
      {
        type: 'Utilisateur',
        title: 'Malek Amari',
        subtitle: 'Collaborateur • malek.amari@smartassign.tn',
        link: '/admin/collaborateurs/edit/11'
      }
    ];

    return fallback.filter((item) => `${item.title} ${item.subtitle}`.toLowerCase().includes(normalized));
  }

  private buildFallbackProjects(): Projet[] {
    return [
      {
        id: 101,
        nom: 'Programme CRM 360',
        description: 'Refonte des parcours commerciaux et support.',
        dateDebut: this.toIsoDate(-55),
        dateFin: this.toIsoDate(4),
        statut: 'en_retard',
        managerNom: 'Sana Ben Ali',
        nombreCollabs: 2,
      },
      {
        id: 102,
        nom: 'Portail RH',
        description: 'Digitalisation des workflows RH internes.',
        dateDebut: this.toIsoDate(-34),
        dateFin: this.toIsoDate(9),
        statut: 'en_cours',
        managerNom: 'Karim Trabelsi',
        nombreCollabs: 3,
      },
      {
        id: 103,
        nom: 'App Mobile Client',
        description: 'Nouveau canal mobile pour le suivi client.',
        dateDebut: this.toIsoDate(-22),
        dateFin: this.toIsoDate(16),
        statut: 'en_cours',
        managerNom: 'Leila Ben Amor',
        nombreCollabs: 4,
      },
      {
        id: 104,
        nom: 'Sprint Data Quality',
        description: 'Fiabilisation du reporting exécutif.',
        dateDebut: this.toIsoDate(-18),
        dateFin: this.toIsoDate(2),
        statut: 'en_pause',
        managerNom: 'Nader Gharbi',
        nombreCollabs: 1,
      },
      {
        id: 105,
        nom: 'Refonte BI',
        description: 'Mise à niveau de la couche reporting.',
        dateDebut: this.toIsoDate(-80),
        dateFin: this.toIsoDate(-7),
        statut: 'termine',
        managerNom: 'Ines Mzoughi',
        nombreCollabs: 3,
      }
    ];
  }

  private buildFallbackCollaborators(): Collaborateur[] {
    return [
      {
        id: 11,
        nom: 'Amari',
        prenom: 'Malek',
        email: 'malek.amari@smartassign.tn',
        role: 'COLLAB',
        experienceAnnees: 6,
        disponible: false,
        competences: [{ nom: 'Angular' }, { nom: 'UX' }, { nom: 'Testing' }]
      },
      {
        id: 12,
        nom: 'Ben Amor',
        prenom: 'Leila',
        email: 'leila.benamor@smartassign.tn',
        role: 'MANAGER',
        experienceAnnees: 9,
        disponible: false,
        competences: [{ nom: 'Pilotage' }, { nom: 'CRM' }]
      },
      {
        id: 13,
        nom: 'Trabelsi',
        prenom: 'Karim',
        email: 'karim.trabelsi@smartassign.tn',
        role: 'MANAGER',
        experienceAnnees: 8,
        disponible: true,
        competences: [{ nom: 'PMO' }, { nom: 'Reporting' }]
      },
      {
        id: 14,
        nom: 'Gharbi',
        prenom: 'Nader',
        email: 'nader.gharbi@smartassign.tn',
        role: 'COLLAB',
        experienceAnnees: 4,
        disponible: false,
        competences: [{ nom: 'Data' }, { nom: 'SQL' }, { nom: 'ETL' }]
      },
      {
        id: 15,
        nom: 'Saidi',
        prenom: 'Meriem',
        email: 'meriem.saidi@smartassign.tn',
        role: 'COLLAB',
        experienceAnnees: 3,
        disponible: true,
        competences: [{ nom: 'QA' }, { nom: 'Automation' }]
      },
      {
        id: 16,
        nom: 'Mzoughi',
        prenom: 'Ines',
        email: 'ines.mzoughi@smartassign.tn',
        role: 'ADMIN',
        experienceAnnees: 11,
        disponible: true,
        competences: [{ nom: 'Gouvernance' }, { nom: 'Portfolio' }]
      }
    ];
  }

  private toIsoDate(offsetInDays: number): string {
    const date = new Date();
    date.setDate(date.getDate() + offsetInDays);
    return date.toISOString().slice(0, 10);
  }
}