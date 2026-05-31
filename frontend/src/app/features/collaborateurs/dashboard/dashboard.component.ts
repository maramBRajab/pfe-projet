import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { RouterModule, Router } from '@angular/router';
import { catchError, forkJoin, of, switchMap } from 'rxjs';

import {
  Affectation,
  AffectationService,
  Collaborateur,
  CollaborateurPlanningDto,
  CollaborateurService,
  PlanningService
} from '../../../services/collaborateur';

import { AuthService } from '../../../services/auth';
import { CollaborateurShellComponent } from '../shared/collaborateur-shell.component';

type BadgeTone = 'success' | 'warning' | 'danger' | 'neutral';

interface StatusBadge {
  label: string;
  tone: BadgeTone;
}

interface DashboardKpiCard {
  label: string;
  value: number | string;
  hintBadge: StatusBadge;
  trendBadge: StatusBadge;
  link: string;
  queryParams?: Record<string, string>;
}

interface DashboardPlanningCard {
  projet: string;
  periode: string;
  statutBadge: StatusBadge;
  charge: number;
  chargeBadge: StatusBadge;
  link: string;
  queryParams?: Record<string, string>;
}

interface DashboardWorkspaceCard {
  icon: string;
  title: string;
  text: string;
  link: string;
}

interface DashboardHeroStat {
  value: number | string;
  label: string;
  warn?: boolean;
}

interface DashboardStatWidget {
  label: string;
  value: number | string;
  hint: string;
  tone?: 'default' | 'alert';
}

interface DashboardAlertItem {
  type: 'info' | 'warning' | 'danger';
  message: string;
  time: string;
}

interface DashboardActivityItem {
  initiales: string;
  action: string;
  temps: string;
  categorie: 'collab' | 'projet' | 'admin';
}

interface DashboardWorkloadBar {
  week: string;
  hours: number;
  isActive: boolean;
}

interface DashboardProjectLoadItem {
  nom: string;
  charge: number;
  tone: 'low' | 'mid' | 'high';
}

interface DashboardSkillItem {
  nom: string;
  niveau: string;
  stars: number;
}

interface DashboardDataBundle {
  collaborateur: Collaborateur;
  planning: CollaborateurPlanningDto | null;
  affectations: Affectation[];
}

@Component({
  selector: 'app-collaborateur-dashboard',
  standalone: true,
  imports: [CommonModule, RouterModule, CollaborateurShellComponent],
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.scss']
})
export class CollaborateurDashboardComponent implements OnInit {

  currentDate = new Date();
  userName = 'Collaborateur';
  isLoading = true;
  errorMessage = '';

  planning: DashboardPlanningCard[] = [];
  kpiCards: DashboardKpiCard[] = [];
  heroStats: DashboardHeroStat[] = [];
  statWidgets: DashboardStatWidget[] = [];
  alertes: DashboardAlertItem[] = [];
  activiteRecente: DashboardActivityItem[] = [];
  workloadChartData: DashboardWorkloadBar[] = [];
  projectLoadData: DashboardProjectLoadItem[] = [];
  competences: DashboardSkillItem[] = [];
  footerAvailability = 'Disponible';
  footerMissions = 0;
  footerCharge = '0%';
  kpiProjectsCount = 0;
  kpiSkillsCount = 0;

  workspaceCards: DashboardWorkspaceCard[] = [
    { icon: 'PRJ', title: 'Consulter mes projets', text: 'Voir projets', link: '/mes-projets' },
    { icon: 'PLN', title: 'Mon planning', text: 'Voir planning', link: '/mon-planning' },
    { icon: 'SKL', title: 'Competences', text: 'Voir competences', link: '/competences' }
  ];

  constructor(
    private router: Router,
    private authService: AuthService,
    private collaborateurService: CollaborateurService,
    private affectationService: AffectationService,
    private planningService: PlanningService
  ) {}

  ngOnInit(): void {
    this.userName = this.authService.currentUser?.nom || 'Collaborateur';
    this.loadData();
  }

  loadData(): void {
    this.isLoading = true;
    this.errorMessage = '';

    const email = this.authService.currentUser?.email?.trim();

    if (!email) {
      this.errorMessage = 'Session collaborateur introuvable.';
      this.isLoading = false;
      return;
    }

    this.collaborateurService.getByEmail(email).pipe(
      switchMap((collaborateur) => {
        if (!collaborateur.id) {
          return of({ collaborateur, planning: null, affectations: [] } satisfies DashboardDataBundle);
        }

        return forkJoin({
          planning: this.planningService.getByCollaborateur(collaborateur.id).pipe(catchError(() => of(null))),
          affectations: this.affectationService.getByCollaborateur(collaborateur.id).pipe(catchError(() => of([])))
        }).pipe(
          switchMap(({ planning, affectations }) => {
            return of({
              collaborateur,
              planning,
              affectations: planning?.affectations?.length ? planning.affectations : affectations
            } satisfies DashboardDataBundle);
          })
        );
      })
    ).subscribe({
      next: (data) => {
        this.consumeData(data);
        this.isLoading = false;
      },
      error: () => {
        this.errorMessage = 'Impossible de charger le dashboard collaborateur.';
        this.isLoading = false;
      }
    });
  }

  // 🔥 DOUBLE CLICK NAVIGATION
  goToDashboard(): void {
    this.router.navigate(['/collaborateurs/dashboard']);
  }

  private consumeData(data: DashboardDataBundle): void {
    const affectations = data.affectations.slice().sort((first, second) => {
      return new Date(second.dateAffectation).getTime() - new Date(first.dateAffectation).getTime();
    });
    const activeMissions = affectations.filter((affectation) => this.isActiveProject(affectation.projet.statut));
    const availabilityState = this.resolveAvailabilityKey(data.planning?.disponibiliteEtat, data.collaborateur.disponible);
    const availabilityLabel = this.resolveAvailabilityValue(availabilityState, data.planning?.disponibiliteMessage);
    const completedMissions = affectations.filter((affectation) => this.normalizeKey(affectation.projet.statut ?? '') === 'termine');
    const criticalProjects = affectations.filter((affectation) => this.projectLoadFromScore(affectation.score, affectation.projet.statut) >= 90);
    const topSkills = (data.collaborateur.competences ?? []).slice(0, 3).map((competence) => competence.nom).filter(Boolean);

    this.kpiCards = [
      this.buildKpiCard(
        'Missions',
        activeMissions.length,
        activeMissions.length ? 'actives' : 'warning',
        activeMissions.length ? 'ok' : 'warning'
      ),
      this.buildKpiCard('Disponibilite', availabilityLabel, 'statut', availabilityState)
    ];

    this.heroStats = [
      { value: activeMissions.length, label: 'Projets actifs' },
      { value: topSkills.length || 0, label: 'Competences clefs' },
      { value: criticalProjects.length, label: 'Priorites', warn: criticalProjects.length > 0 }
    ];

    // Merge skills: profile + required skills from assigned projects
    const profileSkillNames = (data.collaborateur.competences ?? []).map(c => c.nom).filter(Boolean);
    const affectationSkillNames = affectations
      .flatMap(a => (a.projet.competencesRequises ?? []).map(c => c.nom))
      .filter(Boolean);
    const mergedSkillNames = [...new Set([...profileSkillNames, ...affectationSkillNames])];

    // Charge: use actual avg if affectations exist, else 18% base if partial/active leaves
    const conges = data.planning?.conges ?? [];
    const baseCharge = this.computeAverageLoad(affectations);
    const chargeValue = affectations.length
      ? baseCharge
      : (conges.length && availabilityState !== 'indisponible' ? 18 : 0);

    // Formatted availability hint
    const availHint = this.formatAvailabilityHint(
      data.planning?.disponibiliteMessage, availabilityState, conges
    );

    this.statWidgets = [
      {
        label: 'Projets actifs',
        value: activeMissions.length,
        hint: completedMissions.length
          ? `${completedMissions.length} mission(s) terminée(s)`
          : 'Missions en cours de suivi'
      },
      {
        label: 'Disponibilite',
        value: availabilityLabel,
        hint: availHint
      },
      {
        label: 'Competences',
        value: mergedSkillNames.length,
        hint: mergedSkillNames.length
          ? mergedSkillNames.slice(0, 3).join(' · ')
          : 'Aucune renseignée'
      },
      {
        label: 'Charge moyenne',
        value: `${chargeValue}%`,
        hint: criticalProjects.length
          ? `${criticalProjects.length} projet(s) à surveiller`
          : 'Charge maîtrisée',
        tone: criticalProjects.length ? 'alert' : 'default'
      }
    ];

    this.planning = affectations.slice(0, 3).map((affectation) => this.buildPlanningCard(
      affectation.projet.nom,
      this.buildProjectPeriodLabel(affectation.projet.dateDebut, affectation.projet.dateFin),
      this.normalizeProjectStatus(affectation.projet.statut),
      this.projectLoadFromScore(affectation.score, affectation.projet.statut),
      affectation.projet.nom
    ));

    this.alertes = this.buildAlerts(activeMissions.length, availabilityState, criticalProjects.length);
    this.activiteRecente = this.buildRecentActivity(activeMissions, topSkills, availabilityLabel);
    this.workloadChartData = this.buildWorkloadChartData(affectations);
    this.projectLoadData = this.buildProjectLoadData(affectations);
    this.competences = this.buildSkillItems(data.collaborateur.competences ?? []);
    this.footerAvailability = availabilityLabel;
    this.footerMissions = activeMissions.length;
    this.footerCharge = this.computeAverageLoad(affectations) + '%';
    this.kpiProjectsCount = activeMissions.length;
    this.kpiSkillsCount = +(this.statWidgets[2]?.value ?? 0);
  }

  get planningCount(): number {
    return this.planning.length;
  }

  get dashboardStatusTone(): 'stable' | 'watch' | 'risk' {
    if (this.alertes.some((alerte) => alerte.type === 'danger')) {
      return 'risk';
    }

    if (this.footerAvailability !== 'Disponible' || this.alertes.some((alerte) => alerte.type === 'warning')) {
      return 'watch';
    }

    return 'stable';
  }

  get dashboardStatusLabel(): string {
    if (this.dashboardStatusTone === 'risk') {
      return 'Attention requise';
    }

    if (this.dashboardStatusTone === 'watch') {
      return '\u00c0 surveiller';
    }

    return 'Rythme ma\u00eetris\u00e9';
  }

  reloadDashboard(): void {
    this.loadData();
  }

  statKey(label: string): string {
    return this.normalizeKey(label);
  }

  statCardTone(stat: DashboardStatWidget): 'blue' | 'green' | 'amber' | 'slate' {
    const key = this.statKey(stat.label);

    if (key === 'disponibilite') {
      return this.footerAvailability === 'Disponible' ? 'green' : 'amber';
    }

    if (key === 'charge_moyenne' || stat.tone === 'alert') {
      return 'amber';
    }

    if (key === 'projets_actifs') {
      return 'blue';
    }

    return 'slate';
  }

  statChipTone(stat: DashboardStatWidget): 'up' | 'neutral' | 'warn' | 'risk' {
    const key = this.statKey(stat.label);

    if (key === 'disponibilite' && this.footerAvailability !== 'Disponible') {
      return 'warn';
    }

    if (key === 'charge_moyenne' && stat.tone === 'alert') {
      return 'risk';
    }

    if (key === 'projets_actifs' || key === 'competences') {
      return 'up';
    }

    return 'neutral';
  }

  statChipLabel(stat: DashboardStatWidget): string {
    const key = this.statKey(stat.label);

    if (key === 'disponibilite') {
      return this.footerAvailability;
    }

    if (key === 'charge_moyenne' && stat.tone === 'alert') {
      return 'Priorite';
    }

    if (key === 'projets_actifs') {
      return 'En cours';
    }

    if (key === 'competences') {
      return 'Profil';
    }

    return 'Synthese';
  }

  alertTone(type: DashboardAlertItem['type']): BadgeTone {
    if (type === 'danger') {
      return 'danger';
    }

    if (type === 'warning') {
      return 'warning';
    }

    return 'neutral';
  }

  private buildKpiCard(label: string, value: number | string, rawHint: string, rawTrend: string): DashboardKpiCard {
    return {
      label,
      value,
      hintBadge: this.buildBadge(rawHint),
      trendBadge: this.buildBadge(rawTrend, label),
      link: this.resolveKpiLink(label),
    };
  }

  private buildPlanningCard(projet: string, periode: string, rawStatus: string, charge: number, focusProject?: string): DashboardPlanningCard {
    const normalizedCharge = this.normalizeCharge(charge);

    return {
      projet,
      periode,
      statutBadge: this.buildBadge(rawStatus),
      charge: normalizedCharge,
      chargeBadge: this.buildChargeBadge(normalizedCharge),
      link: this.resolvePlanningLink(),
      queryParams: focusProject ? { focus: focusProject } : undefined,
    };
  }

  private resolveKpiLink(label: string): string {
    const normalizedLabel = this.normalizeKey(label);

    if (normalizedLabel === 'missions') {
      return '/mes-projets';
    }

    if (normalizedLabel === 'disponibilite') {
      return '/mon-planning';
    }

    return '/dashboard';
  }

  private resolvePlanningLink(): string {
    return '/mes-projets';
  }

  private buildBadge(rawValue: string, context = ''): StatusBadge {
    const value = this.normalizeKey(rawValue);
    const normalizedContext = this.normalizeKey(context);

    const labelMap: Record<string, string> = {
      actives: 'Actives',
      active: 'Active',
      statut: 'Statut',
      ok: normalizedContext === 'missions' ? 'Maitrise' : 'Conforme',
      good: normalizedContext === 'disponibilite' ? 'Disponible' : 'Bon niveau',
      disponible: 'Disponible',
      available: 'Disponible',
      partielle: 'Disponibilite partielle',
      indisponible: 'Indisponible',
      busy: 'Charge elevee',
      warning: 'Attention',
      problem: 'Probleme',
      error: 'Probleme',
      en_cours: 'En cours',
      encours: 'En cours',
      en_attente: 'En attente',
      attente: 'En attente',
      pending: 'En attente',
      termine: 'Termine',
      terminee: 'Termine',
      bloque: 'Bloque',
      blocked: 'Bloque',
    };

    return {
      label: labelMap[value] ?? this.toReadableLabel(rawValue),
      tone: this.resolveTone(value),
    };
  }

  private buildChargeBadge(charge: number): StatusBadge {
    if (charge >= 90) {
      return { label: 'Surcharge ' + charge + '%', tone: 'danger' };
    }

    if (charge >= 70) {
      return { label: 'Charge elevee ' + charge + '%', tone: 'warning' };
    }

    return { label: 'Charge maitrisee ' + charge + '%', tone: 'success' };
  }

  private resolveTone(value: string): BadgeTone {
    if (['ok', 'good', 'disponible', 'available', 'actives', 'active', 'en_cours', 'encours'].includes(value)) {
      return 'success';
    }

    if (['warning', 'busy', 'en_attente', 'attente', 'pending', 'partielle'].includes(value)) {
      return 'warning';
    }

    if (['problem', 'error', 'indisponible', 'bloque', 'blocked'].includes(value)) {
      return 'danger';
    }

    return 'neutral';
  }

  private normalizeCharge(charge: number): number {
    if (Number.isNaN(charge)) {
      return 0;
    }

    return Math.max(0, Math.min(100, Math.round(charge)));
  }

  private normalizeKey(value: string): string {
    return value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim()
      .toLowerCase()
      .replace(/\s+/g, '_');
  }

  private toReadableLabel(value: string): string {
    const sanitized = value.replace(/[_-]+/g, ' ').trim();

    if (!sanitized) {
      return 'Statut';
    }

    return sanitized.charAt(0).toUpperCase() + sanitized.slice(1).toLowerCase();
  }

  private isActiveProject(status: string | undefined): boolean {
    return !['termine', 'annule'].includes(this.normalizeKey(status ?? ''));
  }

  private resolveAvailabilityKey(state: string | undefined, disponible: boolean): string {
    const normalizedState = this.normalizeKey(state ?? '');

    if (['disponible', 'partielle', 'indisponible'].includes(normalizedState)) {
      return normalizedState;
    }

    return disponible ? 'disponible' : 'indisponible';
  }

  private resolveAvailabilityValue(state: string, message?: string): string {
    if (message?.trim()) {
      const normalizedMessage = this.normalizeKey(message);

      if (normalizedMessage.includes('partielle')) {
        return 'Partielle';
      }

      if (normalizedMessage.includes('indisponible')) {
        return 'Indisponible';
      }

      if (normalizedMessage.includes('disponible')) {
        return 'Disponible';
      }
    }

    if (state === 'partielle') {
      return 'Partielle';
    }

    if (state === 'indisponible') {
      return 'Indisponible';
    }

    return 'Disponible';
  }

  private normalizeProjectStatus(status: string | undefined): string {
    const normalizedStatus = this.normalizeKey(status ?? '');

    if (normalizedStatus === 'en_attente') {
      return 'en_attente';
    }

    if (normalizedStatus === 'termine') {
      return 'termine';
    }

    return 'en_cours';
  }

  private buildProjectPeriodLabel(start: string, end: string): string {
    return this.formatShortDate(start) + ' - ' + this.formatShortDate(end);
  }

  private formatShortDate(date: string): string {
    return new Date(date).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
  }

  private formatAvailabilityHint(
    raw: string | undefined,
    state: string,
    conges: Array<{ dateDebut: string; dateFin: string }>
  ): string {
    if (conges.length) {
      const first = conges[0];
      const start = new Date(first.dateDebut).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' });
      const end   = new Date(first.dateFin).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' });
      if (state === 'partielle')    return `Réduite du ${start} au ${end}`;
      if (state === 'indisponible') return `Indisponible du ${start} au ${end}`;
    }
    if (!raw?.trim()) return 'Statut collaborateur courant';
    return raw
      .replace(/(\d{4})-(\d{2})-(\d{2})/g, (_: string, y: string, m: string, d: string) =>
        new Date(+y, +m - 1, +d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })
      )
      .replace(/\bdisponibilite\b/gi, 'Disponibilité')
      .replace(/\breduite\b/gi, 'réduite')
      .trim();
  }

  private projectLoadFromScore(score: number, status: string | undefined): number {
    const normalizedStatus = this.normalizeKey(status ?? '');

    if (normalizedStatus === 'termine') {
      return 100;
    }

    if (normalizedStatus === 'en_attente') {
      return Math.max(20, Math.min(55, Math.round(score * 0.5)));
    }

    return Math.max(35, Math.min(95, Math.round(score)));
  }

  private computeAverageLoad(affectations: Affectation[]): number {
    if (!affectations.length) {
      return 0;
    }

    const total = affectations.reduce((sum, affectation) => {
      return sum + this.projectLoadFromScore(affectation.score, affectation.projet.statut);
    }, 0);

    return Math.round(total / affectations.length);
  }

  private buildWorkloadChartData(affectations: Affectation[]): DashboardWorkloadBar[] {
    const currentMonth = new Date();
    const baseLoad = this.computeAverageLoad(affectations);

    return Array.from({ length: 4 }, (_, index) => {
      const weekLoad = affectations[index]
        ? this.projectLoadFromScore(affectations[index].score, affectations[index].projet.statut)
        : Math.max(18, baseLoad - ((3 - index) * 6));

      return {
        week: `S${index + 1}`,
        hours: this.normalizeHours(Math.round((weekLoad / 100) * 40)),
        isActive: index === this.resolveCurrentWeekIndex(currentMonth)
      };
    });
  }

  private buildProjectLoadData(affectations: Affectation[]): DashboardProjectLoadItem[] {
    return affectations.slice(0, 4).map((affectation) => {
      const charge = this.projectLoadFromScore(affectation.score, affectation.projet.statut);

      return {
        nom: affectation.projet.nom,
        charge,
        tone: this.resolveLoadTone(charge)
      };
    });
  }

  private buildSkillItems(competences: Collaborateur['competences']): DashboardSkillItem[] {
    return (competences ?? []).slice(0, 5).map((competence, index) => {
      const stars = Math.max(3, 5 - index);

      return {
        nom: competence.nom,
        niveau: this.resolveSkillLevel(stars),
        stars
      };
    });
  }

  private resolveCurrentWeekIndex(date: Date): number {
    return Math.min(3, Math.max(0, Math.ceil(date.getDate() / 7) - 1));
  }

  private normalizeHours(hours: number): number {
    return Math.max(8, Math.min(40, hours));
  }

  private resolveLoadTone(charge: number): 'low' | 'mid' | 'high' {
    if (charge >= 85) {
      return 'high';
    }

    if (charge >= 60) {
      return 'mid';
    }

    return 'low';
  }

  private resolveSkillLevel(stars: number): string {
    if (stars >= 5) {
      return 'Expert';
    }

    if (stars >= 4) {
      return 'Avance';
    }

    return 'Intermediaire';
  }

  private buildAlerts(activeMissions: number, availabilityState: string, criticalProjects: number): DashboardAlertItem[] {
    const items: DashboardAlertItem[] = [];

    if (criticalProjects > 0) {
      items.push({
        type: 'danger',
        message: `${criticalProjects} projet(s) demandent une attention immediate sur la charge ou les priorites.`,
        time: 'mise a jour recente'
      });
    }

    if (availabilityState === 'partielle' || availabilityState === 'indisponible') {
      items.push({
        type: 'warning',
        message: `Votre disponibilite est actuellement marquee comme ${this.toReadableLabel(availabilityState)}.`,
        time: 'etat collaborateur'
      });
    }

    items.push({
      type: 'info',
      message: `${activeMissions} mission(s) active(s) sont visibles dans votre espace collaborateur.`,
      time: 'tableau de bord'
    });

    return items.slice(0, 3);
  }

  private buildRecentActivity(activeMissions: Affectation[], topSkills: string[], availabilityLabel: string): DashboardActivityItem[] {
    const items: DashboardActivityItem[] = [];

    if (activeMissions[0]) {
      items.push({
        initiales: 'PR',
        action: `Projet prioritaire : ${activeMissions[0].projet.nom}`,
        temps: this.buildProjectPeriodLabel(activeMissions[0].projet.dateDebut, activeMissions[0].projet.dateFin),
        categorie: 'projet'
      });
    }

    if (topSkills.length) {
      items.push({
        initiales: 'SK',
        action: `Competences mises en avant : ${topSkills.join(', ')}`,
        temps: 'profil collaborateur',
        categorie: 'collab'
      });
    }

    items.push({
      initiales: 'ET',
      action: `Disponibilite actuelle : ${availabilityLabel}`,
      temps: 'planning courant',
      categorie: 'admin'
    });

    return items;
  }

  // ── New getters for redesigned template ─────────────────
  get userInitials(): string {
    const nom = this.authService.currentUser?.nom?.trim() ?? '';
    return nom.split(' ').map(p => p[0] ?? '').join('').slice(0, 2).toUpperCase() || 'CD';
  }

  get profileCompletion(): number {
    return this.competences.length > 0 ? 65 : 40;
  }

  get missingItems(): string {
    return this.competences.length === 0
      ? 'Compétences, Photo'
      : 'Photo de profil';
  }
}