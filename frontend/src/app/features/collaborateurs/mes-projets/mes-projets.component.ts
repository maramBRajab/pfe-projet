import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Subscription, of, switchMap } from 'rxjs';

import {
  CollaborateurService,
  MesProjetsDto,
  MesProjetsJalonDto,
  MesProjetsTacheDto,
  PlanningService,
} from '../../../services/collaborateur';
import { AuthService } from '../../../services/auth';
import { KpiCardComponent, KpiCardTone } from '../../../shared/kpi-card/kpi-card.component';
import { CollaborateurShellComponent } from '../shared/collaborateur-shell.component';
import { CollabTopbarComponent } from '../shared/collab-topbar.component';

type ProjectFilter = 'all' | 'en-cours' | 'revision' | 'en-attente' | 'termine';

interface ProjectMetric {
  label: string;
  value: string | number;
  hint: string;
}

interface ProjectFilterPill {
  key: ProjectFilter;
  label: string;
  count: number;
}

@Component({
  selector: 'app-collaborateur-mes-projets',
  standalone: true,
  imports: [CommonModule, KpiCardComponent, CollaborateurShellComponent, CollabTopbarComponent],
  templateUrl: './mes-projets.component.html',
  styleUrl: './mes-projets.component.scss'
})
export class CollaborateurMesProjetsComponent implements OnInit, OnDestroy {
  today = new Date();
  isLoading = true;
  errorMessage = '';
  userName = 'Collaborateur';
  activeFilter: ProjectFilter = 'all';

  dashboardData: MesProjetsDto = {
    projetsActifs: 0,
    chargeActuelle: 0,
    compatibiliteMoyenne: 0,
    projetsTermines: 0,
    taches: [],
    jalons: []
  };

  metrics: ProjectMetric[] = [];
  filters: ProjectFilterPill[] = [];
  currentCollaborateurId: number | null = null;
  updatingTaskIds = new Set<number>();
  actionMessage = '';
  actionError = '';

  private routeSub?: Subscription;

  constructor(
    private readonly authService: AuthService,
    private readonly collaborateurService: CollaborateurService,
    private readonly planningService: PlanningService,
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.initUser();
    this.routeSub = this.route.queryParamMap.subscribe(() => {
      this.cdr.detectChanges();
    });
    this.loadMesProjets();
  }

  ngOnDestroy(): void {
    this.routeSub?.unsubscribe();
  }

  get statusLabel(): string {
    return this.activeFilter !== 'all' ? 'Filtre actif' : 'Portefeuille a jour';
  }

  get headerStatusTone(): 'stable' | 'watch' {
    return this.activeFilter !== 'all' ? 'watch' : 'stable';
  }

  get filteredTaches(): MesProjetsTacheDto[] {
    const taches = this.dashboardData.taches ?? [];
    if (this.activeFilter === 'all') {
      return taches;
    }

    return taches.filter((tache) => this.mapTaskStatusToFilter(tache.statut) === this.activeFilter);
  }

  get jalons(): MesProjetsJalonDto[] {
    return this.dashboardData.jalons ?? [];
  }

  metricKey(label: string): string {
    return label
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim()
      .toLowerCase()
      .replace(/\s+/g, '_');
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

  kpiBadgeClass(metric: ProjectMetric): string {
    const key = this.metricKey(metric.label);

    if (key === 'charge_actuelle') {
      return 'mp-kbadge--amber';
    }

    if (key === 'projets_termines') {
      return 'mp-kbadge--purple';
    }

    if (key === 'projets_actifs') {
      return 'mp-kbadge--blue';
    }

    return 'mp-kbadge--green';
  }

  kpiCardTone(metric: ProjectMetric): KpiCardTone {
    const key = this.metricKey(metric.label);

    if (key === 'charge_actuelle') {
      return 'amber';
    }

    if (key === 'projets_termines') {
      return 'purple';
    }

    if (key === 'projets_actifs') {
      return 'blue';
    }

    return 'green';
  }

  kpiValueTone(metric: ProjectMetric): KpiCardTone {
    const key = this.metricKey(metric.label);
    return key === 'charge_actuelle' ? 'amber' : key === 'compatibilite_moyenne' ? 'green' : 'neutral';
  }

  primaryProjectAction(): void {
    this.router.navigate(['/mon-planning']);
  }

  refreshProjects(): void {
    this.loadMesProjets();
  }

  updateTaskStatus(task: MesProjetsTacheDto, statut: 'EN_COURS' | 'TERMINE'): void {
    const taskId = task.id ?? null;
    if (!this.currentCollaborateurId || !taskId || this.updatingTaskIds.has(taskId)) {
      return;
    }

    this.actionMessage = '';
    this.actionError = '';
    this.updatingTaskIds.add(taskId);

    this.planningService.updateTaskStatus(this.currentCollaborateurId, taskId, statut).subscribe({
      next: (updated) => {
        this.dashboardData = {
          ...this.dashboardData,
          taches: (this.dashboardData.taches ?? []).map((item) =>
            item.id === taskId ? { ...item, statut: updated.statut } : item
          )
        };
        this.filters = this.buildFilters(this.dashboardData.taches ?? []);
        this.actionMessage = statut === 'TERMINE' ? 'Tache marquee comme terminee.' : 'Tache marquee en cours.';
        this.updatingTaskIds.delete(taskId);
        this.cdr.detectChanges();
      },
      error: () => {
        this.actionError = 'Impossible de mettre a jour le statut de la tache.';
        this.updatingTaskIds.delete(taskId);
        this.cdr.detectChanges();
      }
    });
  }

  canStartTask(task: MesProjetsTacheDto): boolean {
    return !!task.id && this.mapTaskStatusToFilter(task.statut) !== 'en-cours' && this.mapTaskStatusToFilter(task.statut) !== 'termine';
  }

  canCompleteTask(task: MesProjetsTacheDto): boolean {
    return !!task.id && this.mapTaskStatusToFilter(task.statut) !== 'termine';
  }

  isUpdatingTask(task: MesProjetsTacheDto): boolean {
    return !!task.id && this.updatingTaskIds.has(task.id);
  }

  setFilter(filter: ProjectFilter): void {
    this.activeFilter = filter;
  }

  tacheStatusLabel(statut: string): string {
    const key = this.normalizeStatus(statut);

    if (key === 'en_cours') {
      return 'En cours';
    }

    if (key === 'en_revision') {
      return 'En revision';
    }

    if (key === 'en_attente' || key === 'a_faire') {
      return 'En attente';
    }

    if (key === 'termine' || key === 'terminee') {
      return 'Termine';
    }

    return statut || 'En attente';
  }

  tacheStatusClass(statut: string): string {
    const key = this.mapTaskStatusToFilter(statut);

    if (key === 'en-cours') {
      return 'mp-pcard__status mp-pcard__status--encours';
    }

    if (key === 'revision') {
      return 'mp-pcard__status mp-pcard__status--revision';
    }

    if (key === 'termine') {
      return 'mp-pcard__status mp-pcard__status--termine';
    }

    return 'mp-pcard__status mp-pcard__status--attente';
  }

  formatPriorityLabel(priority: string | null | undefined): 'Critique' | 'Haute' | 'Moyenne' | 'Basse' {
    const normalized = (priority ?? '').trim().toLowerCase();

    if (normalized === 'critique') {
      return 'Critique';
    }

    if (normalized === 'haute') {
      return 'Haute';
    }

    if (normalized === 'basse') {
      return 'Basse';
    }

    return 'Moyenne';
  }

  isTaskLate(task: MesProjetsTacheDto): boolean {
    if (this.mapTaskStatusToFilter(task.statut) === 'termine') {
      return false;
    }

    const dueDate = new Date(task.dateEcheance);
    if (Number.isNaN(dueDate.getTime())) {
      return false;
    }

    const currentDate = new Date();
    const dueDay = new Date(dueDate.getFullYear(), dueDate.getMonth(), dueDate.getDate());
    const currentDay = new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate());
    return dueDay < currentDay;
  }

  get userInitials(): string {
    const nom = this.authService.currentUser?.nom?.trim() ?? '';
    return nom.split(' ').map((p) => p[0] ?? '').join('').slice(0, 2).toUpperCase() || 'CD';
  }

  private initUser(): void {
    const session = this.authService.currentUser;
    if (session) {
      this.userName = session.nom;
    }
  }

  private loadMesProjets(): void {
    this.isLoading = true;
    this.errorMessage = '';

    const email = this.authService.currentUser?.email?.trim();

    if (!email) {
      this.errorMessage = 'Session collaborateur introuvable.';
      this.isLoading = false;
      this.cdr.detectChanges();
      return;
    }

    this.collaborateurService.getByEmail(email).pipe(
      switchMap((collaborateur) => {
        if (!collaborateur.id) {
          this.currentCollaborateurId = null;
          return of({
            projetsActifs: 0,
            chargeActuelle: 0,
            compatibiliteMoyenne: 0,
            projetsTermines: 0,
            taches: [],
            jalons: []
          } satisfies MesProjetsDto);
        }

        this.currentCollaborateurId = collaborateur.id;
        return this.collaborateurService.getMesProjets(collaborateur.id);
      })
    ).subscribe({
      next: (data) => {
        this.dashboardData = {
          ...data,
          taches: data.taches ?? [],
          jalons: data.jalons ?? []
        };

        this.metrics = this.buildMetrics(this.dashboardData);
        this.filters = this.buildFilters(this.dashboardData.taches ?? []);
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

  private buildMetrics(data: MesProjetsDto): ProjectMetric[] {
    return [
      {
        label: 'Projets actifs',
        value: data.projetsActifs,
        hint: 'projets en cours via vos affectations'
      },
      {
        label: 'Charge actuelle',
        value: `${Math.round(data.chargeActuelle)}%`,
        hint: 'moyenne des scores d affectation'
      },
      {
        label: 'Compatibilite moyenne',
        value: `${Math.round(data.compatibiliteMoyenne)}%`,
        hint: 'alignement moyen de vos missions'
      },
      {
        label: 'Projets termines',
        value: data.projetsTermines,
        hint: 'projets termines dans vos affectations'
      }
    ];
  }

  private buildFilters(taches: MesProjetsTacheDto[]): ProjectFilterPill[] {
    const count = (filter: ProjectFilter): number => {
      if (filter === 'all') {
        return taches.length;
      }
      return taches.filter((tache) => this.mapTaskStatusToFilter(tache.statut) === filter).length;
    };

    return [
      { key: 'all', label: 'Toutes', count: count('all') },
      { key: 'en-cours', label: 'En cours', count: count('en-cours') },
      { key: 'revision', label: 'En revision', count: count('revision') },
      { key: 'en-attente', label: 'En attente', count: count('en-attente') },
      { key: 'termine', label: 'Terminees', count: count('termine') }
    ];
  }

  private mapTaskStatusToFilter(statut: string): ProjectFilter {
    const normalized = this.normalizeStatus(statut);

    if (normalized === 'en_cours' || normalized === 'in_progress') {
      return 'en-cours';
    }

    if (normalized === 'en_revision' || normalized === 'revision') {
      return 'revision';
    }

    if (normalized === 'termine' || normalized === 'terminee' || normalized === 'done') {
      return 'termine';
    }

    return 'en-attente';
  }

  private normalizeStatus(value: string): string {
    return (value || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim()
      .toLowerCase()
      .replace(/\s+/g, '_');
  }
}
