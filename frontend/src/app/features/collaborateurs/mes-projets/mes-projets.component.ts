import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Subscription, forkJoin, of, switchMap } from 'rxjs';

import { Affectation, AffectationService, CollaborateurService, NotificationService, Projet, ProjetService } from '../../../services/collaborateur';
import { AuthService } from '../../../services/auth';
import { CollaborateurShellComponent } from '../shared/collaborateur-shell.component';

type ProjectFilter = 'all' | 'en-cours' | 'revision' | 'en-attente' | 'termine';

interface ProjectMetric { label: string; value: string | number; hint: string; }
interface ProjectFilterPill { key: ProjectFilter; label: string; count: number; }
interface TeamAvatar { label: string; color: string; background: string; }
interface CollaborateurProjectCard {
  id: number; nom: string; description: string; domaine: string; domaineColor: string; domaineBackground: string;
  statusLabel: string; statusKey: ProjectFilter; progress: number; missionDates: string; membersCount: number;
  team: TeamAvatar[]; role: string; compatibilite: number;
}

@Component({
  selector: 'app-collaborateur-mes-projets',
  standalone: true,
  imports: [CommonModule, CollaborateurShellComponent],
  templateUrl: './mes-projets.component.html',
  styleUrl: './mes-projets.component.scss'
})
export class CollaborateurMesProjetsComponent implements OnInit {
  today = new Date();
  isLoading = true;
  errorMessage = '';
  userName = 'Collaborateur';
  activeFilter: ProjectFilter = 'all';
  focusProject = '';
  metrics: ProjectMetric[] = [];
  filters: ProjectFilterPill[] = [];
  allProjects: CollaborateurProjectCard[] = [];
  private routeSub?: Subscription;

  constructor(
    private readonly authService: AuthService,
    private readonly collaborateurService: CollaborateurService,
    private readonly affectationService: AffectationService,
    private readonly projetService: ProjetService,
    private readonly notificationService: NotificationService,
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.initUser();
    this.routeSub = this.route.queryParamMap.subscribe((params) => {
      this.focusProject = params.get('focus')?.trim() ?? '';
      this.cdr.detectChanges();
    });
    this.loadProjects();
  }

  ngOnDestroy(): void {
    this.routeSub?.unsubscribe();
  }

  get statusLabel(): string {
    if (this.focusProject) {
      return 'Projet cible';
    }

    if (this.activeFilter !== 'all') {
      return 'Filtre actif';
    }

    return 'Portefeuille à jour';
  }

  get filteredProjects(): CollaborateurProjectCard[] {
    const byProject = this.focusProject ? this.allProjects.filter((project) => project.nom.toLowerCase() === this.focusProject.toLowerCase()) : this.allProjects;
    return this.activeFilter === 'all' ? byProject : byProject.filter((project) => project.statusKey === this.activeFilter);
  }

  get headerStatusTone(): 'stable' | 'watch' {
    return this.focusProject || this.activeFilter !== 'all' ? 'watch' : 'stable';
  }

  metricTone(metric: ProjectMetric): 'blue' | 'green' | 'amber' | 'slate' {
    const key = this.metricKey(metric.label);

    if (key === 'projets_actifs') {
      return 'blue';
    }

    if (key === 'charge_actuelle') {
      return 'amber';
    }

    if (key === 'compatibilite_moyenne') {
      return 'green';
    }

    return 'slate';
  }

  metricChipTone(metric: ProjectMetric): 'up' | 'neutral' | 'warn' {
    const key = this.metricKey(metric.label);

    if (key === 'charge_actuelle') {
      return 'warn';
    }

    if (key === 'projets_termines') {
      return 'neutral';
    }

    return 'up';
  }

  metricChipLabel(metric: ProjectMetric): string {
    const key = this.metricKey(metric.label);

    if (key === 'charge_actuelle') {
      return 'Suivi';
    }

    if (key === 'projets_termines') {
      return 'Archive';
    }

    if (key === 'compatibilite_moyenne') {
      return 'Alignement';
    }

    return 'Actif';
  }

  metricKey(label: string): string {
    return label
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim()
      .toLowerCase()
      .replace(/\s+/g, '_');
  }

  primaryProjectAction(): void {
    const targetProject = this.filteredProjects[0];

    if (targetProject) {
      this.openPlanning(targetProject);
      return;
    }

    this.router.navigate(['/planning']);
  }

  refreshProjects(): void {
    this.loadProjects();
  }

  setFilter(filter: ProjectFilter): void { this.activeFilter = filter; }

  clearFocus(): void {
    this.focusProject = '';
    this.router.navigate([], { relativeTo: this.route, queryParams: { focus: null }, queryParamsHandling: 'merge' });
  }

  sendPrompt(project: CollaborateurProjectCard): void {
    this.notificationService.pushLocal({ type: 'DETAIL_PROJET', titre: 'Details projet demandes', message: `Le detail du projet ${project.nom} est pret a etre consulte.`, niveau: 'INFO', dateCreation: new Date().toISOString() });
  }

  openPlanning(project: CollaborateurProjectCard): void {
    this.notificationService.pushLocal({ type: 'PLANNING_PROJET', titre: 'Planning du projet', message: `Redirection vers le planning de ${project.nom}.`, niveau: 'INFO', dateCreation: new Date().toISOString() });
    this.router.navigate(['/mon-planning'], { queryParams: { focus: project.nom } });
  }

  statusTone(status: ProjectFilter): 'success' | 'warning' | 'neutral' {
    if (status === 'en-cours' || status === 'termine') {
      return 'success';
    }

    if (status === 'en-attente') {
      return 'warning';
    }

    return 'neutral';
  }

  projectCardTone(status: ProjectFilter): 'watch' | 'neutral' {
    return status === 'revision' || status === 'en-attente' ? 'watch' : 'neutral';
  }

  trackByProject(_: number, project: CollaborateurProjectCard): number { return project.id; }

  get userInitials(): string {
    const nom = this.authService.currentUser?.nom?.trim() ?? '';
    return nom.split(' ').map(p => p[0] ?? '').join('').slice(0, 2).toUpperCase() || 'CD';
  }

  progressColor(progress: number): string {
    if (progress >= 100) return '#10b981';
    if (progress >= 70)  return '#f59e0b';
    if (progress >= 27)  return '#3b82f6';
    return '#94a3b8';
  }

  cardBorderColor(status: ProjectFilter): string {
    if (status === 'revision')  return '#f59e0b';
    if (status === 'termine')   return '#10b981';
    if (status === 'en-cours')  return '#3b82f6';
    return '#94a3b8';
  }

  private initUser(): void {
    const session = this.authService.currentUser;
    if (session) { this.userName = session.nom; }
  }

  private loadProjects(): void {
    this.isLoading = true;
    this.errorMessage = '';
    const session = this.authService.currentUser;
    const email = session?.email?.trim();

    if (!session || !email) {
      this.errorMessage = 'Session collaborateur introuvable.';
      this.isLoading = false;
      this.cdr.detectChanges();
      return;
    }

    this.collaborateurService.getByEmail(email).pipe(
      switchMap((collaborateur) => {
        if (!collaborateur.id) { return of({ affectations: [] as Affectation[], projets: [] as Projet[] }); }
        return forkJoin({ affectations: this.affectationService.getByCollaborateur(collaborateur.id), projets: this.projetService.getAll() });
      })
    ).subscribe({
      next: ({ affectations, projets }) => {
        this.allProjects = this.buildProjectCards(affectations, projets).slice(0, 6);
        this.metrics = this.buildMetrics(this.allProjects);
        this.filters = this.buildFilters(this.allProjects);
        this.isLoading = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.errorMessage = 'Impossible de charger la page Mes Projets.';
        this.isLoading = false;
        this.cdr.detectChanges();
      }
    });
  }

  private buildProjectCards(affectations: Affectation[], projets: Projet[]): CollaborateurProjectCard[] {
    const assignedCards = affectations.slice().sort((a, b) => new Date(b.dateAffectation).getTime() - new Date(a.dateAffectation).getTime()).map((affectation, index) => this.mapAssignedProject(affectation, index));
    if (assignedCards.length >= 6) { return assignedCards; }
    const assignedIds = new Set(affectations.map((affectation) => affectation.projet.id));
    const fallbackCards = projets.filter((projet) => !assignedIds.has(projet.id ?? -1)).slice(0, Math.max(0, 6 - assignedCards.length)).map((projet, index) => this.mapFallbackProject(projet, index + assignedCards.length));
    return [...assignedCards, ...fallbackCards];
  }

  private buildMetrics(projects: CollaborateurProjectCard[]): ProjectMetric[] {
    const activeProjects = projects.filter((project) => project.statusKey === 'en-cours' || project.statusKey === 'revision').length;
    const currentLoad = projects.length ? Math.min(100, Math.round(projects.reduce((sum, project) => sum + project.progress, 0) / projects.length)) : 0;
    const compatibilite = projects.length ? Math.round(projects.reduce((sum, project) => sum + project.compatibilite, 0) / projects.length) : 0;
    const finished = projects.filter((project) => project.statusKey === 'termine').length;
    return [
      { label: 'Projets actifs', value: activeProjects, hint: 'missions en cours ou en revision' },
      { label: 'Charge actuelle', value: `${currentLoad}%`, hint: 'moyenne de progression de vos projets' },
      { label: 'Compatibilite moyenne', value: `${compatibilite}%`, hint: 'alignement global avec les besoins projet' },
      { label: 'Projets termines', value: finished, hint: 'missions cloturees avec succes' }
    ];
  }

  private buildFilters(projects: CollaborateurProjectCard[]): ProjectFilterPill[] {
    const count = (filter: ProjectFilter) => filter === 'all' ? projects.length : projects.filter((project) => project.statusKey === filter).length;
    return [
      { key: 'all', label: 'Tous', count: count('all') },
      { key: 'en-cours', label: 'En cours', count: count('en-cours') },
      { key: 'revision', label: 'En revision', count: count('revision') },
      { key: 'en-attente', label: 'En attente', count: count('en-attente') },
      { key: 'termine', label: 'Termines', count: count('termine') }
    ];
  }

  private mapAssignedProject(affectation: Affectation, index: number): CollaborateurProjectCard {
    const project = affectation.projet;
    const projectTheme = this.projectTheme(project, index);
    const status = this.projectStatus(project.statut, affectation.score, false);
    const competences = (project.competencesRequises ?? []).map((competence) => competence.nom);
    return { id: affectation.id, nom: project.nom, description: project.description, domaine: projectTheme.domain, domaineColor: projectTheme.color, domaineBackground: projectTheme.background, statusLabel: status.label, statusKey: status.key, progress: this.projectProgress(project.statut, affectation.score), missionDates: `${this.formatShortDate(project.dateDebut)} - ${this.formatShortDate(project.dateFin)}`, membersCount: Math.max(3, Math.min(8, competences.length + 2 + (index % 3))), team: this.buildTeam(projectTheme, competences, index), role: this.projectRole(competences, false), compatibilite: Math.round(affectation.score) };
  }

  private mapFallbackProject(project: Projet, index: number): CollaborateurProjectCard {
    const projectTheme = this.projectTheme(project, index);
    const pseudoScore = Math.max(68, Math.min(93, 72 + index * 5));
    const status = this.projectStatus(project.statut, pseudoScore, true);
    const competences = (project.competencesRequises ?? []).map((competence) => competence.nom);
    return { id: (project.id ?? 0) * 1000 + index, nom: project.nom, description: project.description, domaine: projectTheme.domain, domaineColor: projectTheme.color, domaineBackground: projectTheme.background, statusLabel: status.label, statusKey: status.key, progress: this.projectProgress(project.statut, pseudoScore), missionDates: `${this.formatShortDate(project.dateDebut)} - ${this.formatShortDate(project.dateFin)}`, membersCount: Math.max(4, Math.min(9, competences.length + 3 + (index % 2))), team: this.buildTeam(projectTheme, competences, index), role: this.projectRole(competences, true), compatibilite: pseudoScore };
  }

  private projectTheme(project: Projet, index: number): { domain: string; color: string; background: string } {
    const signature = `${project.nom} ${(project.competencesRequises ?? []).map((competence) => competence.nom).join(' ')}`.toLowerCase();
    if (signature.includes('angular') || signature.includes('react') || signature.includes('typescript')) { return { domain: 'Frontend', color: '#fbcfe8', background: 'linear-gradient(135deg, #ec4899, #7c3aed)' }; }
    if (signature.includes('java') || signature.includes('spring') || signature.includes('node')) { return { domain: 'Backend', color: '#bfdbfe', background: 'linear-gradient(135deg, #2563eb, #7c3aed)' }; }
    if (signature.includes('docker') || signature.includes('devops') || signature.includes('python')) { return { domain: 'Data & Ops', color: '#bbf7d0', background: 'linear-gradient(135deg, #10b981, #2563eb)' }; }
    const fallback = [
      { domain: 'Produit', color: '#fde68a', background: 'linear-gradient(135deg, #f59e0b, #ec4899)' },
      { domain: 'Innovation', color: '#ddd6fe', background: 'linear-gradient(135deg, #7c3aed, #0ea5e9)' },
      { domain: 'Delivery', color: '#bfdbfe', background: 'linear-gradient(135deg, #3b82f6, #6366f1)' }
    ];
    return fallback[index % fallback.length];
  }

  private projectStatus(status: string, score: number, fallback: boolean): { label: string; key: ProjectFilter } {
    if (status === 'en_attente') { return { label: 'En attente', key: 'en-attente' }; }
    if (status === 'termine') { return { label: 'Termine', key: 'termine' }; }
    if (status === 'en_cours' && score >= 85) { return { label: 'En revision', key: 'revision' }; }
    if (fallback) { return { label: 'En revision', key: 'revision' }; }
    return { label: 'En cours', key: 'en-cours' };
  }

  private projectProgress(status: string, score: number): number {
    if (status === 'termine') { return 100; }
    if (status === 'en_attente') { return Math.max(18, Math.min(42, Math.round(score * 0.35))); }
    return Math.max(36, Math.min(96, Math.round(score)));
  }

  private projectRole(competences: string[], fallback: boolean): string {
    const skills = competences.map((competence) => competence.toLowerCase());
    if (skills.some((skill) => ['angular', 'react', 'typescript'].includes(skill))) { return fallback ? 'Referent UI potentiel' : 'Lead Frontend'; }
    if (skills.some((skill) => ['java', 'spring boot', 'node.js'].includes(skill))) { return fallback ? 'Contributeur backend' : 'Developpeur backend'; }
    if (skills.some((skill) => ['docker', 'devops', 'python'].includes(skill))) { return fallback ? 'Support data & ops' : 'Contributeur plateforme'; }
    return fallback ? 'Contribution a confirmer' : 'Collaborateur projet';
  }

  private buildTeam(theme: { color: string; background: string }, competences: string[], index: number): TeamAvatar[] {
    const pool = competences.length ? competences : ['PM', 'UX', 'QA'];
    return pool.slice(0, 3).map((competence, avatarIndex) => ({ label: this.initials(competence), color: theme.color, background: avatarIndex === 0 ? theme.background : 'rgba(255, 255, 255, 0.08)' })).concat({ label: `+${Math.max(1, (index % 3) + 1)}`, color: '#f8fafc', background: 'rgba(15, 23, 42, 0.7)' });
  }

  private formatShortDate(date: string): string { return new Date(date).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' }); }
  private initials(value: string): string { return value.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase() ?? '').join(''); }
}