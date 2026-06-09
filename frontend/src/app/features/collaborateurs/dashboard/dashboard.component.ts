import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { RouterModule, Router } from '@angular/router';
import { catchError, forkJoin, of, switchMap } from 'rxjs';

import {
  Affectation,
  Collaborateur,
  CollaborateurDashboardResponse,
  CollaborateurService,
} from '../../../services/collaborateur';

import { AuthService } from '../../../services/auth';
import { KpiCardComponent, KpiCardTone } from '../../../shared/kpi-card/kpi-card.component';
import { CollaborateurShellComponent } from '../shared/collaborateur-shell.component';
import { CollabTopbarComponent } from '../shared/collab-topbar.component';

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

@Component({
  selector: 'app-collaborateur-dashboard',
  standalone: true,
  imports: [CommonModule, RouterModule, KpiCardComponent, CollaborateurShellComponent, CollabTopbarComponent],
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.scss']
})
export class CollaborateurDashboardComponent implements OnInit {

  currentDate = new Date();
  userName = '';
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
  footerAvailability = '';
  footerMissions = 0;
  footerCharge = '0%';
  kpiProjectsCount = 0;
  kpiSkillsCount = 0;
    averageCharge = 0;

  constructor(
    private router: Router,
    private authService: AuthService,
    private collaborateurService: CollaborateurService
  ) {}

  ngOnInit(): void {
    this.userName = this.authService.currentUser?.nom?.trim() || '';
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
      switchMap((collaborateur) => forkJoin({
        collaborateur: of(collaborateur),
        dashboard: this.collaborateurService.getDashboard(collaborateur.id ?? 0).pipe(
          catchError(() => of(null as CollaborateurDashboardResponse | null))
        )
      })),
      catchError(() => of(null))
    ).subscribe({
      next: (result) => {
        if (!result || !result.dashboard) {
          this.errorMessage = 'Impossible de charger le dashboard collaborateur.';
          this.isLoading = false;
          return;
        }

        const dashboard = result.dashboard;
        const collaborateur = result.collaborateur;

        this.userName = dashboard.collaborateurNom || this.buildCollaborateurName(collaborateur) || this.userName;
        this.consumeDashboard(dashboard);

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

  private consumeDashboard(dashboard: CollaborateurDashboardResponse): void {
    const availabilityLabel = dashboard.disponibilite?.etat?.trim() || '';
    this.averageCharge = dashboard.chargeMoyenne ?? 0;

    this.statWidgets = [
      {
        label: 'Projets actifs',
        value: dashboard.projetsActifs,
        hint: `${dashboard.projetsActifs} projet(s) actif(s)`
      },
      {
        label: 'Disponibilite',
        value: availabilityLabel,
        hint: this.buildAvailabilityHint(availabilityLabel)
      },
      {
        label: 'Competences',
        value: dashboard.competencesCount,
        hint: dashboard.competencesCount > 0
          ? `${dashboard.competencesCount} competence(s) renseignee(s)`
          : 'Aucune competence renseignee'
      },
      {
        label: 'Charge moyenne',
        value: `${this.averageCharge}%`,
        hint: this.averageCharge >= 80 ? 'Charge elevee' : 'Charge maitrisee',
        tone: this.averageCharge >= 80 ? 'alert' : 'default'
      }
    ];

    this.planning = (dashboard.prochainsJalons ?? []).slice(0, 5).map((jalon) => this.buildPlanningCard(
      jalon.projet || 'Projet non precise',
      jalon.dateEcheance ? `Echeance ${jalon.dateEcheance}` : 'Echeance non definie',
      this.normalizeProjectStatus(jalon.statut),
      jalon.charge,
      jalon.jalon
    ));

    this.alertes = this.buildVigilanceAlerts(dashboard.pointsVigilance?.entries ?? []);

    this.activiteRecente = (dashboard.activiteRecente ?? []).slice(0, 5).map((entry) => ({
      initiales: entry.initiales || 'JR',
      action: entry.action,
      temps: entry.temps || entry.createdAt || 'recemment',
      categorie: entry.categorie || 'collab'
    }));

    this.footerAvailability = availabilityLabel;
    this.footerMissions = dashboard.projetsActifs;
    this.footerCharge = `${this.averageCharge}%`;
    this.kpiProjectsCount = dashboard.projetsActifs;
    this.kpiSkillsCount = dashboard.competencesCount;
    this.competences = [];
  }

  private estimateJalonCharge(statut: string): number {
    const key = this.normalizeKey(statut || '');

    if (key.includes('termine')) {
      return 100;
    }

    if (key.includes('cours')) {
      return 75;
    }

    if (key.includes('planifier') || key.includes('attente')) {
      return 45;
    }

    return 60;
  }

  private resolveAlertType(type: string): DashboardAlertItem['type'] {
    const key = this.normalizeKey(type || '');

    if (key.includes('danger') || key.includes('critique')) {
      return 'danger';
    }

    if (key.includes('warning') || key.includes('alerte')) {
      return 'warning';
    }

    return 'info';
  }

  private initialsFromAction(action: string): string {
    const raw = (action || '').trim();
    if (!raw) {
      return 'JR';
    }
    return raw
      .split(/[_\s-]+/)
      .map((part) => part.charAt(0))
      .join('')
      .slice(0, 2)
      .toUpperCase();
  }

  private buildAvailabilityHint(statut: string): string {
    const key = this.normalizeKey(statut || '');
    if (key.includes('conge')) {
      return 'Indisponible pendant le conge planifie';
    }
    if (key.includes('occupe')) {
      return 'Charge RH en cours';
    }
    return 'Disponible pour les prochaines affectations';
  }

  private buildVigilanceAlerts(entries: string[]): DashboardAlertItem[] {
    return entries.slice(0, 3).map((message, index) => {
      const normalized = this.normalizeKey(message);
      const type: DashboardAlertItem['type'] = normalized.includes('surcharg') || normalized.includes('indisponible')
        ? 'danger'
        : normalized.includes('attention') || normalized.includes('elevee') || normalized.includes('reduite')
          ? 'warning'
          : 'info';

      return {
        type,
        message,
        time: index === 0 ? 'mise a jour recente' : 'tableau de bord'
      };
    });
  }

  private buildCollaborateurName(collaborateur: Collaborateur | null): string {
    if (!collaborateur) {
      return '';
    }

    return `${collaborateur.prenom ?? ''} ${collaborateur.nom ?? ''}`.trim();
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

  kpiCardTone(stat: DashboardStatWidget): KpiCardTone {
    const tone = this.statCardTone(stat);
    return tone === 'slate' ? 'neutral' : tone;
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
      return 'Priorité';
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

  kpiValueTone(stat: DashboardStatWidget): KpiCardTone {
    const key = this.statKey(stat.label);

    if (key === 'disponibilite') {
      return this.footerAvailability === 'Disponible' ? 'green' : 'amber';
    }

    if (key === 'charge_moyenne') {
      return stat.tone === 'alert' ? 'red' : 'green';
    }

    return 'neutral';
  }

  planningDotColor(item: DashboardPlanningCard): string {
    if (item.statutBadge.tone === 'danger') {
      return '#c41e3a';
    }

    if (item.statutBadge.tone === 'warning') {
      return '#f59e0b';
    }

    return '#3b82f6';
  }

  planningPillClass(item: DashboardPlanningCard): string {
    if (item.chargeBadge.tone === 'danger') {
      return 'cd-jalon__pill--red';
    }

    if (item.chargeBadge.tone === 'warning') {
      return 'cd-jalon__pill--amber';
    }

    return 'cd-jalon__pill--blue';
  }

  alertCardClass(alert: DashboardAlertItem): string {
    if (alert.type === 'warning') {
      return 'cd-alert--warning';
    }

    if (alert.type === 'danger') {
      return 'cd-alert--danger';
    }

    return 'cd-alert--info';
  }

  alertBadgeClass(alert: DashboardAlertItem): string {
    if (alert.type === 'warning') {
      return 'cd-alert__badge--warning';
    }

    if (alert.type === 'danger') {
      return 'cd-alert__badge--danger';
    }

    return 'cd-alert__badge--info';
  }

  alertIconClass(alert: DashboardAlertItem): string {
    if (alert.type === 'warning') {
      return 'ti ti-alert-triangle cd-alert__ico';
    }

    if (alert.type === 'danger') {
      return 'ti ti-alert-circle cd-alert__ico';
    }

    return 'ti ti-info-circle cd-alert__ico';
  }

  traduireType(type: string): string {
    const map: Record<string, string> = {
      'MODIFICATION_PROFIL': 'Modification du profil',
      'MISE_A_JOUR_PROFIL': 'Mise à jour du profil',
      'MISE_A_JOUR_COMPETENCES': 'Mise à jour des compétences',
      'CONNEXION': 'Connexion réussie',
      'DECONNEXION': 'Déconnexion',
      'LOGIN': 'Connexion réussie',
      'LOGOUT': 'Déconnexion',
      'AFFECTATION': 'Nouvelle affectation',
      'FIN_AFFECTATION': 'Fin d\'affectation',
      'NOUVEAU_PROJET': 'Nouveau projet assigné',
      'TACHE_ASSIGNEE': 'Tâche assignée',
      'JALON_PROCHE': 'Jalon à venir',
      'SURCHARGE': 'Surcharge de travail',
      'DISPONIBILITE': 'Changement de disponibilité',
    };

    return map[type] ?? type.toLowerCase().replace(/_/g, ' ');
  }

  translatedAlertMessage(alert: DashboardAlertItem): string {
    const raw = (alert.message ?? '').trim();
    if (!raw) {
      return '';
    }

    return /^[A-Z0-9_]+$/.test(raw) ? this.traduireType(raw) : raw;
  }

  translatedAlertType(alert: DashboardAlertItem): string {
    if (alert.type === 'danger') {
      return 'Critique';
    }

    if (alert.type === 'warning') {
      return 'Vigilance';
    }

    return 'Information';
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
    if (charge > 85) {
      return { label: 'Charge élevée ' + charge + '%', tone: 'danger' };
    }

    if (charge >= 70) {
      return { label: 'Charge maîtrisée ' + charge + '%', tone: 'warning' };
    }

    return { label: 'Charge faible ' + charge + '%', tone: 'success' };
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

  private parseDashboardDate(value: string | undefined): Date | null {
    if (!value) {
      return null;
    }

    const isoParsed = new Date(value);
    if (!Number.isNaN(isoParsed.getTime())) {
      return isoParsed;
    }

    const frenchPattern = /^(\d{2})\/(\d{2})\/(\d{4})(?:\s+(\d{2}):(\d{2}))?$/;
    const match = value.trim().match(frenchPattern);
    if (!match) {
      return null;
    }

    const day = Number.parseInt(match[1], 10);
    const month = Number.parseInt(match[2], 10) - 1;
    const year = Number.parseInt(match[3], 10);
    const hour = Number.parseInt(match[4] ?? '0', 10);
    const minute = Number.parseInt(match[5] ?? '0', 10);

    const parsed = new Date(year, month, day, hour, minute, 0, 0);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
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
    const source = this.userName.trim() || this.authService.currentUser?.nom?.trim() || '';
    return source.split(' ').map((part) => part[0] ?? '').join('').slice(0, 2).toUpperCase();
  }
}
