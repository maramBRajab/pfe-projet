import { CommonModule, DatePipe } from '@angular/common';
import { ChangeDetectorRef, Component, OnDestroy, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { Subscription, catchError, of, switchMap } from 'rxjs';

import { Affectation, AffectationService, CollaborateurService } from '../../../services/collaborateur';
import { AuthService } from '../../../services/auth';
import { CollaborateurShellComponent } from '../shared/collaborateur-shell.component';
import { CollabTopbarComponent } from '../shared/collab-topbar.component';

type HistoryStatus = 'all' | 'termine' | 'suspendu' | 'annule';
interface HistoryMetric { label: string; value: string | number; hint: string; }
interface MissionHistoryItem { id: number; projectName: string; client: string; role: string; status: Exclude<HistoryStatus, 'all'>; statusLabel: string; statusTone: 'done' | 'hold' | 'cancel'; periodLabel: string; year: string; compatibility: number; workedDays: number; startedAt: Date; endedAt: Date; skills: string[]; description: string; }
interface TimelineEntry { id: string; title: string; subtitle: string; date: Date; tone: 'done' | 'hold' | 'cancel' | 'start'; }
interface SkillUsageItem { name: string; count: number; percent: number; color: string; }

@Component({
  selector: 'app-collaborateur-historique',
  standalone: true,
  imports: [CommonModule, FormsModule, DatePipe, CollaborateurShellComponent, CollabTopbarComponent],
  templateUrl: './historique.component.html',
  styleUrl: './historique.component.scss'
})
export class CollaborateurHistoriqueComponent implements OnInit {
  readonly today = new Date();
  isLoading = true;
  errorMessage = '';
  userName = 'Collaborateur';
  searchTerm = '';
  statusFilter: HistoryStatus = 'all';
  yearFilter = 'all';
  metrics: HistoryMetric[] = [];
  allMissions: MissionHistoryItem[] = [];
  timeline: TimelineEntry[] = [];
  topSkills: SkillUsageItem[] = [];
  availableYears: string[] = [];
  private routeSub?: Subscription;

  constructor(
    private readonly authService: AuthService,
    private readonly collaborateurService: CollaborateurService,
    private readonly affectationService: AffectationService,
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.userName = this.authService.currentUser?.nom ?? this.userName;
    this.routeSub = this.route.queryParamMap.subscribe((params) => {
      this.searchTerm = params.get('focus')?.trim() ?? '';
      this.cdr.detectChanges();
    });
    this.loadHistory();
  }

  ngOnDestroy(): void {
    this.routeSub?.unsubscribe();
  }

  get filteredMissions(): MissionHistoryItem[] {
    const normalizedSearch = this.searchTerm.trim().toLowerCase();
    return this.allMissions.filter((mission) => (!normalizedSearch || mission.projectName.toLowerCase().includes(normalizedSearch) || mission.client.toLowerCase().includes(normalizedSearch) || mission.role.toLowerCase().includes(normalizedSearch)) && (this.statusFilter === 'all' || mission.status === this.statusFilter) && (this.yearFilter === 'all' || mission.year === this.yearFilter));
  }

  trackByMission(_: number, mission: MissionHistoryItem): number { return mission.id; }
  trackByTimeline(_: number, item: TimelineEntry): string { return item.id; }
  openMissionPlanning(mission: MissionHistoryItem): void { this.router.navigate(['/mon-planning'], { queryParams: { focus: mission.projectName } }); }
  openMissionProject(mission: MissionHistoryItem): void { this.router.navigate(['/mes-projets'], { queryParams: { focus: mission.projectName } }); }
  openMissionProfile(mission: MissionHistoryItem): void { this.router.navigate(['/competences'], { queryParams: { tab: 'skills', focusMission: mission.projectName, focusSkills: mission.skills.join(',') } }); }

  get userInitials(): string {
    const nom = this.authService.currentUser?.nom?.trim() ?? '';
    return nom.split(' ').map(p => p[0] ?? '').join('').slice(0, 2).toUpperCase() || 'CD';
  }

  get topSkillNames(): string[] { return this.topSkills.map(s => s.name); }

  compatColor(compat: number): string {
    if (compat >= 80) return '#10b981';
    if (compat >= 70) return '#f59e0b';
    return '#ef4444';
  }

  missionBorderColor(tone: MissionHistoryItem['statusTone']): string {
    if (tone === 'done')   return '#10b981';
    if (tone === 'cancel') return '#ef4444';
    return '#f59e0b';
  }

  timelineDotColor(tone: TimelineEntry['tone']): string {
    if (tone === 'done')   return '#10b981';
    if (tone === 'cancel') return '#ef4444';
    if (tone === 'start')  return '#3b82f6';
    return '#f59e0b';
  }
  get headerStatusTone(): 'stable' | 'watch' {
    return this.searchTerm.trim() || this.statusFilter !== 'all' || this.yearFilter !== 'all' ? 'watch' : 'stable';
  }
  get headerStatusLabel(): string {
    if (this.searchTerm.trim()) {
      return 'Recherche active';
    }

    if (this.statusFilter !== 'all' || this.yearFilter !== 'all') {
      return 'Filtres actifs';
    }

    return 'Historique complet';
  }
  metricKey(label: string): string { return label.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase().replace(/\s+/g, '_'); }
  metricTone(metric: HistoryMetric): 'blue' | 'green' | 'amber' | 'slate' {
    const key = this.metricKey(metric.label);

    if (key === 'total_missions') {
      return 'blue';
    }

    if (key === 'missions_terminees') {
      return 'green';
    }

    if (key === 'compatibilite_moyenne') {
      return 'amber';
    }

    return 'slate';
  }
  metricChipTone(metric: HistoryMetric): 'up' | 'neutral' | 'warn' {
    const key = this.metricKey(metric.label);

    if (key === 'compatibilite_moyenne') {
      return 'warn';
    }

    if (key === 'jours_travailles') {
      return 'neutral';
    }

    return 'up';
  }
  metricChipLabel(metric: HistoryMetric): string {
    const key = this.metricKey(metric.label);

    if (key === 'compatibilite_moyenne') {
      return 'Alignement';
    }

    if (key === 'jours_travailles') {
      return 'Volume';
    }

    if (key === 'missions_terminees') {
      return 'Clôturées';
    }

    return 'Historique';
  }
  kpiBadgeClass(metric: HistoryMetric): string {
    const tone = this.metricChipTone(metric);
    const key = this.metricKey(metric.label);

    if (tone === 'warn') {
      return 'hist-kbadge--amber';
    }

    if (key === 'jours_travailles') {
      return 'hist-kbadge--purple';
    }

    if (key === 'missions_terminees') {
      return 'hist-kbadge--green';
    }

    return 'hist-kbadge--blue';
  }
  refreshHistory(): void {
    this.loadHistory();
  }
  missionTone(statusTone: MissionHistoryItem['statusTone']): 'success' | 'warning' | 'danger' {
    if (statusTone === 'done') {
      return 'success';
    }

    if (statusTone === 'hold') {
      return 'warning';
    }

    return 'danger';
  }

  private loadHistory(): void {
    this.isLoading = true;
    this.errorMessage = '';
    const session = this.authService.currentUser;
    const email = session?.email?.trim();
    if (!session || !email) { this.errorMessage = 'Session collaborateur introuvable.'; this.isLoading = false; this.cdr.detectChanges(); return; }

    this.collaborateurService.getByEmail(email).pipe(
      switchMap((collaborateur) => {
        if (!collaborateur.id) { return of({ affectations: [] as Affectation[] }); }
        return this.collaborateurService.getHistorique(collaborateur.id).pipe(
          switchMap((affectations) => of({ affectations })),
          catchError(() => {
            console.warn('Impossible de charger les affectations historiques, affichage vide.');
            return of({ affectations: [] as Affectation[] });
          })
        );
      }),
      catchError(() => {
        console.warn('Impossible de resoudre le collaborateur courant, affichage d\'un historique vide.');
        return of({ affectations: [] as Affectation[] });
      })
    ).subscribe({
      next: ({ affectations }) => {
        this.allMissions = this.buildMissionHistory(affectations);
        this.metrics = this.buildMetrics(this.allMissions);
        this.timeline = this.buildTimeline(this.allMissions);
        this.topSkills = this.buildTopSkills(this.allMissions);
        this.availableYears = [...new Set(this.allMissions.map((mission) => mission.year))].sort((a, b) => Number(b) - Number(a));
        this.isLoading = false;
        this.cdr.detectChanges();
      },
      error: () => { 
        this.errorMessage = 'Impossible de charger la page Historique (erreur serveur).'; 
        this.isLoading = false; 
        this.cdr.detectChanges(); 
      }
    });
  }

  private buildMissionHistory(affectations: Affectation[]): MissionHistoryItem[] {
    const missions = affectations
      .slice()
      .sort((a, b) => new Date(b.dateAffectation).getTime() - new Date(a.dateAffectation).getTime())
      .map((affectation, index) => this.mapAffectation(affectation, index));

    return missions.sort((first, second) => second.endedAt.getTime() - first.endedAt.getTime());
  }

  private buildMetrics(missions: MissionHistoryItem[]): HistoryMetric[] {
    const total = missions.length;
    const finished = missions.filter((mission) => mission.status === 'termine').length;
    const compatibility = total ? Math.round(missions.reduce((sum, mission) => sum + mission.compatibility, 0) / total) : 0;
    const workedDays = missions.reduce((sum, mission) => sum + mission.workedDays, 0);
    return [
      { label: 'Total missions', value: total, hint: "Missions dans l'historique" },
      { label: 'Missions terminées', value: finished, hint: 'Clôturées avec succès' },
      { label: 'Compatibilité moyenne', value: `${compatibility}%`, hint: 'Adéquation globale' },
      { label: 'Jours travaillés', value: workedDays, hint: 'Cumul des périodes' }
    ];
  }

  private buildTimeline(missions: MissionHistoryItem[]): TimelineEntry[] {
    return missions.slice(0, 6).flatMap((mission) => [
      { id: `${mission.id}-start`, title: 'D\u00e9marrage', subtitle: `${mission.projectName} \u00b7 ${mission.client}`, date: mission.startedAt, tone: 'start' as const },
      { id: `${mission.id}-end`, title: mission.statusLabel, subtitle: `${mission.projectName} \u00b7 ${mission.role}`, date: mission.endedAt, tone: mission.statusTone }
    ]).sort((first, second) => second.date.getTime() - first.date.getTime()).slice(0, 8);
  }
  private buildTopSkills(missions: MissionHistoryItem[]): SkillUsageItem[] { const counts = new Map<string, number>(); missions.forEach((mission) => mission.skills.forEach((skill) => counts.set(skill, (counts.get(skill) ?? 0) + 1))); const ranked = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6); const max = ranked[0]?.[1] ?? 1; const topCount = ranked[0]?.[1] ?? 0; return ranked.map(([name, count], i) => ({ name, count, percent: Math.round((count / max) * 100), color: count === topCount ? '#3b82f6' : '#0891B2' })); }
  private mapAffectation(affectation: Affectation, index: number): MissionHistoryItem {
    const project = affectation.projet;
    const startedAt = new Date(project.dateDebut);
    const endedAt = new Date(project.dateFin);
    const skills = (project.competencesRequises ?? []).map((competence) => competence.nom);
    const status = this.resolveStatus(project.statut);

    return {
      id: affectation.id,
      projectName: project.nom,
      client: project.description || 'Non renseigné',
      role: this.resolveRole(skills),
      status: status.key,
      statusLabel: status.label,
      statusTone: status.tone,
      periodLabel: `${this.formatDate(startedAt)} - ${this.formatDate(endedAt)}`,
      year: String(endedAt.getFullYear()),
      compatibility: Math.round(affectation.score),
      workedDays: this.computeWorkedDays(startedAt, endedAt),
      startedAt,
      endedAt,
      skills,
      description: project.description
    };
  }

  private resolveStatus(status: string): { key: Exclude<HistoryStatus, 'all'>; label: string; tone: 'done' | 'hold' | 'cancel' } {
    const normalized = (status || '').trim().toLowerCase();

    if (normalized === 'termine') {
      return { key: 'termine', label: 'Terminé', tone: 'done' };
    }

    if (normalized === 'annule') {
      return { key: 'annule', label: 'Annulé', tone: 'cancel' };
    }

    if (['actif', 'en_cours', 'in_progress'].includes(normalized)) {
      return { key: 'suspendu', label: 'En cours', tone: 'hold' };
    }

    if (['planifie', 'planifiée'].includes(normalized)) {
      return { key: 'suspendu', label: 'Planifié', tone: 'hold' };
    }

    return { key: 'suspendu', label: 'Suspendu', tone: 'hold' };
  }

  private resolveRole(skills: string[]): string {
    const lowered = skills.map((skill) => skill.toLowerCase());

    if (lowered.some((skill) => ['angular', 'react', 'typescript'].includes(skill))) {
      return 'Lead Frontend';
    }

    if (lowered.some((skill) => ['java', 'spring boot', 'node.js'].includes(skill))) {
      return 'Developpeur backend';
    }

    if (lowered.some((skill) => ['docker', 'python', 'devops'].includes(skill))) {
      return 'Ingenieur integration';
    }

    return 'Analyste fonctionnel';
  }
  private computeWorkedDays(startedAt: Date, endedAt: Date): number { const start = new Date(startedAt.getFullYear(), startedAt.getMonth(), startedAt.getDate()).getTime(); const end = new Date(endedAt.getFullYear(), endedAt.getMonth(), endedAt.getDate()).getTime(); return Math.max(1, Math.floor((end - start) / 86400000) + 1); }
  private formatDate(date: Date): string { return date.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' }); }
}