import { CommonModule, DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnDestroy, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { Observable, Subscription, catchError, of, switchMap } from 'rxjs';

import { Affectation, AffectationService, Collaborateur, Collaborateur as PlanningCollaborateur, CollaborateurPlanningDto, CollaborateurService, PlanningLeaveDto, PlanningService, PlanningTaskDto } from '../../../services/collaborateur';
import { AuthService } from '../../../services/auth';
import { CollaborateurShellComponent } from '../shared/collaborateur-shell.component';

type AvailabilityState = 'disponible' | 'partielle' | 'indisponible';

interface PlanningMetric { label: string; value: string | number; hint: string; }
interface PlanningEvent { id: string; title: string; subtitle: string; date: Date; type: 'mission' | 'task' | 'leave' | 'availability'; accent: string; }
interface PlanningTask { id: string; title: string; project: string; dueDate: Date; status: 'A faire' | 'En cours' | 'Bloquee' | 'Terminee'; priority: 'Haute' | 'Moyenne' | 'Basse'; }
interface CalendarDay { date: Date; dayNumber: number; inCurrentMonth: boolean; isToday: boolean; markers: Array<'mission' | 'task' | 'leave'>; }
interface WorkloadBar { label: string; value: number; tone: 'low' | 'mid' | 'high'; }
interface LeaveItem { id: string; label: string; type: string; impact: 'PARTIELLE' | 'INDISPONIBLE' | 'AUTRE'; startDate: Date; endDate: Date; }

export interface DayDetail {
  date: Date;
  tasks: PlanningTask[];
  leaves: LeaveItem[];
  events: PlanningEvent[];
}

@Component({
  selector: 'app-collaborateur-planning',
  standalone: true,
  imports: [CommonModule, FormsModule, DatePipe, CollaborateurShellComponent],
  templateUrl: './planning.component.html',
  styleUrl: './planning.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CollaborateurPlanningComponent implements OnInit {
  readonly today = new Date();
  isLoading = true;
  errorMessage = '';
  userName = 'Collaborateur';
  availabilityState: AvailabilityState = 'disponible';
  availabilityMessage = '';
  focusProject = '';
  activeProjectFilter = 'all';
  viewedMonth = this.startOfMonth(this.today);
  projectOptions: string[] = [];
  metrics: PlanningMetric[] = [];
  timeline: PlanningEvent[] = [];
  tasks: PlanningTask[] = [];
  calendarDays: CalendarDay[] = [];
  workloadBars: WorkloadBar[] = [];
  leaves: LeaveItem[] = [];
  selectedDay: DayDetail | null = null;
  private allAffectations: Affectation[] = [];
  private allTasks: PlanningTask[] = [];
  private allLeaves: LeaveItem[] = [];
  private routeSub?: Subscription;

  constructor(
    private readonly authService: AuthService,
    private readonly collaborateurService: CollaborateurService,
    private readonly affectationService: AffectationService,
    private readonly planningService: PlanningService,
    private readonly route: ActivatedRoute,
    private readonly cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.userName = this.authService.currentUser?.nom ?? this.userName;
    this.routeSub = this.route.queryParamMap.subscribe((params) => {
      this.focusProject = params.get('focus') ?? '';
      if (this.projectOptions.length) {
        this.activeProjectFilter = this.resolveProjectFilter(this.focusProject);
        this.selectedDay = null;
        this.refreshView();
      }
    });
    this.loadPlanning();
  }

  ngOnDestroy(): void {
    this.routeSub?.unsubscribe();
  }

  get monthLabel(): string { return this.viewedMonth.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' }); }
  get activeProjectLabel(): string { return this.activeProjectFilter === 'all' ? 'Tous les projets' : this.activeProjectFilter; }
  get availabilityLabel(): string { return this.availabilityState === 'partielle' ? 'Disponibilité partielle' : this.availabilityState === 'indisponible' ? 'Indisponible' : 'Disponible'; }
  get headerStatusTone(): 'stable' | 'watch' | 'risk' {
    if (this.availabilityState === 'indisponible') {
      return 'risk';
    }

    if (this.availabilityState === 'partielle' || this.focusProject || this.activeProjectFilter !== 'all') {
      return 'watch';
    }

    return 'stable';
  }

  get headerStatusLabel(): string {
    if (this.headerStatusTone === 'risk') {
      return 'Disponibilite critique';
    }

    if (this.headerStatusTone === 'watch') {
      return 'Suivi actif';
    }

    return 'Planning stable';
  }

  trackByEvent(_: number, event: PlanningEvent): string { return event.id; }
  trackByTask(_: number, task: PlanningTask): string { return task.id; }

  get userInitials(): string {
    const nom = this.authService.currentUser?.nom?.trim() ?? '';
    return nom.split(' ').map(p => p[0] ?? '').join('').slice(0, 2).toUpperCase() || 'CD';
  }

  barHeight(value: number): number { return Math.max(6, Math.round(value * 80 / 100)); }

  barColor(tone: string): string {
    if (tone === 'high') return '#f59e0b';
    if (tone === 'mid')  return '#10b981';
    return '#3b82f6';
  }

  taskStatusLabel(status: PlanningTask['status']): string {
    switch (status) {
      case 'En cours': return 'En cours';
      case 'Terminee': return 'Terminé';
      case 'Bloquee':  return 'Bloquée';
      default: return 'À faire';
    }
  }

  priorityBadgeClass(priority: PlanningTask['priority']): string {
    switch (priority) {
      case 'Haute': return 'plng-badge--red';
      case 'Basse': return 'plng-badge--green';
      default: return 'plng-badge--amber';
    }
  }

  statusBadgeClass(status: PlanningTask['status']): string {
    switch (status) {
      case 'En cours': return 'plng-badge--blue';
      case 'Terminee': return 'plng-badge--green';
      default: return 'plng-badge--gray';
    }
  }
  availabilityTone(): 'success' | 'warning' | 'danger' { return this.availabilityState === 'indisponible' ? 'danger' : this.availabilityState === 'partielle' ? 'warning' : 'success'; }
  taskPriorityTone(priority: PlanningTask['priority']): 'success' | 'warning' | 'danger' | 'neutral' { return priority === 'Haute' ? 'danger' : priority === 'Moyenne' ? 'warning' : 'success'; }
  taskStatusTone(status: PlanningTask['status']): 'success' | 'warning' | 'danger' | 'neutral' { return status === 'Terminee' ? 'success' : status === 'Bloquee' ? 'danger' : status === 'En cours' ? 'warning' : 'neutral'; }
  leaveImpactTone(impact: LeaveItem['impact']): 'success' | 'warning' | 'danger' | 'neutral' { return impact === 'INDISPONIBLE' ? 'danger' : impact === 'PARTIELLE' ? 'warning' : 'neutral'; }
  metricKey(label: string): string { return label.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase().replace(/\s+/g, '_'); }
  metricTone(metric: PlanningMetric): 'blue' | 'green' | 'amber' | 'slate' {
    const key = this.metricKey(metric.label);

    if (key === 'projets_planifies') {
      return 'blue';
    }

    if (key === 'disponibilite') {
      return this.availabilityState === 'disponible' ? 'green' : 'amber';
    }

    if (key === 'charge_moyenne') {
      return 'amber';
    }

    return 'slate';
  }
  metricChipTone(metric: PlanningMetric): 'up' | 'neutral' | 'warn' | 'risk' {
    const key = this.metricKey(metric.label);

    if (key === 'disponibilite' && this.availabilityState === 'indisponible') {
      return 'risk';
    }

    if (key === 'disponibilite' || key === 'charge_moyenne') {
      return 'warn';
    }

    if (key === 'taches_visibles') {
      return 'neutral';
    }

    return 'up';
  }
  metricChipLabel(metric: PlanningMetric): string {
    const key = this.metricKey(metric.label);

    if (key === 'disponibilite') {
      return this.availabilityLabel;
    }

    if (key === 'charge_moyenne') {
      return 'Charge';
    }

    if (key === 'taches_visibles') {
      return 'Backlog';
    }

    return 'Actif';
  }

  refreshPlanning(): void {
    this.selectedDay = null;
    this.loadPlanning();
  }

  previousMonth(): void { this.viewedMonth = new Date(this.viewedMonth.getFullYear(), this.viewedMonth.getMonth() - 1, 1); this.selectedDay = null; this.refreshView(); }
  nextMonth(): void { this.viewedMonth = new Date(this.viewedMonth.getFullYear(), this.viewedMonth.getMonth() + 1, 1); this.selectedDay = null; this.refreshView(); }
  resetMonth(): void { this.viewedMonth = this.startOfMonth(this.today); this.selectedDay = null; this.refreshView(); }
  applyProjectFilter(value: string): void { this.activeProjectFilter = value || 'all'; this.selectedDay = null; this.refreshView(); }

  selectDay(day: CalendarDay): void {
    const iso = this.isoDay(day.date);
    if (this.selectedDay && this.isoDay(this.selectedDay.date) === iso) {
      this.selectedDay = null;
      this.cdr.detectChanges();
      return;
    }
    const dayTasks = this.allTasks.filter(t => this.isoDay(t.dueDate) === iso);
    const dayLeaves = this.allLeaves.filter(l => iso >= this.isoDay(l.startDate) && iso <= this.isoDay(l.endDate));
    const dayEvents = this.timeline.filter(e => this.isoDay(e.date) === iso);
    this.selectedDay = { date: day.date, tasks: dayTasks, leaves: dayLeaves, events: dayEvents };
    this.cdr.detectChanges();
  }

  isDaySelected(day: CalendarDay): boolean {
    return !!this.selectedDay && this.isoDay(this.selectedDay.date) === this.isoDay(day.date);
  }

  closeDay(): void { this.selectedDay = null; this.cdr.detectChanges(); }

  private loadPlanning(): void {
    this.isLoading = true;
    this.errorMessage = '';
    const session = this.authService.currentUser;
    const email = session?.email?.trim();
    if (!session || !email) { this.errorMessage = 'Session collaborateur introuvable.'; this.isLoading = false; this.cdr.detectChanges(); return; }
    this.collaborateurService.getByEmail(email).pipe(
      switchMap((collaborateur) => {
        if (!collaborateur.id) { throw new Error('Collaborateur introuvable'); }
        return this.planningService.getByCollaborateur(collaborateur.id).pipe(catchError(() => this.buildFallbackPlanning(collaborateur, email)));
      })
    ).subscribe({
      next: (planning) => { this.consumePlanning(planning, email); this.isLoading = false; this.cdr.detectChanges(); },
      error: () => { this.errorMessage = 'Impossible de charger la page Planning.'; this.isLoading = false; this.cdr.detectChanges(); }
    });
  }

  private buildFallbackPlanning(collaborateur: Collaborateur, email: string): Observable<CollaborateurPlanningDto> {
    const nc: PlanningCollaborateur = { id: collaborateur.id ?? 0, nom: collaborateur.nom, prenom: collaborateur.prenom, email: collaborateur.email, experienceAnnees: collaborateur.experienceAnnees, disponible: collaborateur.disponible, competences: (collaborateur.competences ?? []).map((c) => ({ id: c.id ?? 0, nom: c.nom })) };
    if (!collaborateur.id) { return of({ collaborateur: nc, disponibiliteEtat: this.readAvailability(email, collaborateur.disponible), disponibiliteMessage: 'Mode de secours active.', affectations: [], taches: [], conges: [] }); }
    return this.affectationService.getByCollaborateur(collaborateur.id).pipe(switchMap((affectations) => {
      const s = this.readAvailability(email, collaborateur.disponible);
      return of({ collaborateur: nc, disponibiliteEtat: s, disponibiliteMessage: 'Mode de secours active.', affectations, taches: this.buildFallbackTasks(affectations), conges: this.buildFallbackLeaves(s) });
    }));
  }

  private consumePlanning(planning: CollaborateurPlanningDto, email: string): void {
    this.userName = this.authService.currentUser?.nom ?? planning.collaborateur?.prenom ?? this.userName;
    this.availabilityState = this.normalizeAvailabilityState(planning.disponibiliteEtat, planning.collaborateur?.disponible ?? true, email);
    this.availabilityMessage = planning.disponibiliteMessage || 'Vision consolidee des missions, taches et conges collaborateur.';
    this.allAffectations = planning.affectations ?? [];
    this.allTasks = (planning.taches ?? []).map((t) => this.mapTask(t));
    this.allLeaves = (planning.conges ?? []).map((l) => this.mapLeave(l));
    this.projectOptions = this.buildProjectOptions(this.allAffectations, this.allTasks);
    this.activeProjectFilter = this.resolveProjectFilter(this.focusProject);
    this.refreshView();
  }

  private resolveProjectFilter(focusProject: string): string {
    if (!focusProject) {
      return 'all';
    }

    return this.projectOptions.find((project) => project.toLowerCase() === focusProject.toLowerCase()) ?? 'all';
  }

  refreshView(): void {
    const month = this.startOfMonth(this.viewedMonth);
    const affectations = this.filterAffectations(this.allAffectations);
    const tasks = this.filterTasks(this.allTasks);
    const leaves = this.filterLeaves(this.allLeaves);
    this.leaves = [...leaves];
    this.tasks = [...tasks];
    this.timeline = this.buildTimeline(affectations, tasks, leaves);
    this.workloadBars = this.buildWorkload(affectations, tasks, leaves);
    this.metrics = this.buildMetrics(affectations, tasks, leaves, this.workloadBars);
    this.calendarDays = this.buildCalendar(month, affectations, tasks, leaves);
    this.cdr.detectChanges();
  }

  private buildMetrics(affectations: Affectation[], tasks: PlanningTask[], leaves: LeaveItem[], charge: WorkloadBar[]): PlanningMetric[] {
    const active = affectations.filter((a) => a.projet.statut !== 'termine').length;
    const avg = charge.length ? Math.round(charge.reduce((s, b) => s + b.value, 0) / charge.length) : 0;
    return [
      { label: 'Projets planifiés', value: active, hint: 'Missions ouvertes' },
      { label: 'Tâches visibles', value: tasks.length, hint: 'Actions depuis le backend' },
      { label: 'Disponibilité', value: this.availabilityLabel, hint: this.availabilityMessage },
      { label: 'Charge moyenne', value: `${avg}%`, hint: `${leaves.length} période(s) de congé` }
    ];
  }

  private buildTimeline(affectations: Affectation[], tasks: PlanningTask[], leaves: LeaveItem[]): PlanningEvent[] {
    const me = affectations.flatMap((a) => [
      { id: `mission-start-${a.id}`, title: a.projet.nom, subtitle: 'Demarrage de mission', date: new Date(a.projet.dateDebut), type: 'mission' as const, accent: '#c4b5fd' },
      { id: `mission-end-${a.id}`, title: a.projet.nom, subtitle: a.projet.statut === 'termine' ? 'Mission terminee' : 'Livraison estimee', date: new Date(a.projet.dateFin), type: 'mission' as const, accent: '#60a5fa' }
    ]);
    const te = tasks.map((t) => ({ id: `task-${t.id}`, title: t.project, subtitle: t.title, date: t.dueDate, type: 'task' as const, accent: '#f9a8d4' }));
    const le = leaves.map((l) => ({ id: `leave-${l.id}`, title: l.label, subtitle: l.type, date: l.startDate, type: 'leave' as const, accent: '#f59e0b' }));
    return [...me, ...te, ...le].sort((a, b) => a.date.getTime() - b.date.getTime()).slice(0, 12);
  }

  private buildWorkload(affectations: Affectation[], tasks: PlanningTask[], leaves: LeaveItem[]): WorkloadBar[] {
    const cs = this.startOfCalendarGrid(this.viewedMonth);
    const bars = Array.from({ length: 6 }, (_, i) => {
      const ws = new Date(cs); ws.setDate(cs.getDate() + i * 7);
      const we = new Date(ws); we.setDate(ws.getDate() + 6);
      const am = affectations.filter((a) => this.overlapsRange(new Date(a.projet.dateDebut), new Date(a.projet.dateFin), ws, we)).length;
      const dt = tasks.filter((t) => this.isDateWithinRange(t.dueDate, ws, we)).length;
      const ld = leaves.reduce((s, l) => s + this.countOverlapDays(l.startDate, l.endDate, ws, we), 0);
      const value = Math.max(12, Math.min(96, 18 + am * 22 + dt * 9 + ld * 4));
      return { label: `S${i + 1}`, value, tone: 'low' as WorkloadBar['tone'] };
    });
    const maxVal = Math.max(...bars.map(b => b.value));
    const minVal = Math.min(...bars.map(b => b.value));
    const range = maxVal - minVal;
    bars.forEach(b => {
      if (b.value >= maxVal - range * 0.15) b.tone = 'high';
      else if (b.value <= minVal + range * 0.15) b.tone = 'mid';
    });
    return bars;
  }

  private buildCalendar(month: Date, affectations: Affectation[], tasks: PlanningTask[], leaves: LeaveItem[]): CalendarDay[] {
    const nm = this.startOfMonth(month);
    const fd = this.startOfCalendarGrid(nm);
    const ti = this.isoDay(this.today);
    const md = new Set<string>(); const td = new Set<string>(tasks.map((t) => this.isoDay(t.dueDate))); const ld = new Set<string>();
    affectations.forEach((a) => this.addDateRangeToSet(md, new Date(a.projet.dateDebut), new Date(a.projet.dateFin)));
    leaves.forEach((l) => this.addDateRangeToSet(ld, l.startDate, l.endDate));
    return Array.from({ length: 42 }, (_, i) => {
      const date = new Date(fd.getFullYear(), fd.getMonth(), fd.getDate() + i);
      const iso = this.isoDay(date);
      return { date, dayNumber: date.getDate(), inCurrentMonth: date.getMonth() === nm.getMonth() && date.getFullYear() === nm.getFullYear(), isToday: iso === ti, markers: [...(md.has(iso) ? ['mission' as const] : []), ...(td.has(iso) ? ['task' as const] : []), ...(ld.has(iso) ? ['leave' as const] : [])] };
    });
  }

  private buildProjectOptions(affectations: Affectation[], tasks: PlanningTask[]): string[] { return [...new Set([...affectations.map((a) => a.projet.nom), ...tasks.map((t) => t.project).filter(Boolean)])].sort((a, b) => a.localeCompare(b, 'fr', { sensitivity: 'base' })); }
  private filterAffectations(affectations: Affectation[]): Affectation[] { const ms = this.startOfMonth(this.viewedMonth); const me = this.endOfMonth(this.viewedMonth); return affectations.filter((a) => (this.activeProjectFilter === 'all' || a.projet.nom === this.activeProjectFilter) && this.overlapsRange(new Date(a.projet.dateDebut), new Date(a.projet.dateFin), ms, me)); }
  private filterTasks(tasks: PlanningTask[]): PlanningTask[] { const ms = this.startOfMonth(this.viewedMonth); const me = this.endOfMonth(this.viewedMonth); return tasks.filter((t) => (this.activeProjectFilter === 'all' || t.project === this.activeProjectFilter) && this.isDateWithinRange(t.dueDate, ms, me)).sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime()); }
  private filterLeaves(leaves: LeaveItem[]): LeaveItem[] { const ms = this.startOfMonth(this.viewedMonth); const me = this.endOfMonth(this.viewedMonth); return leaves.filter((l) => this.overlapsRange(l.startDate, l.endDate, ms, me)).sort((a, b) => a.startDate.getTime() - b.startDate.getTime()); }
  private normalizeAvailabilityState(value: string | undefined, disponible: boolean, email: string): AvailabilityState { const n = (value ?? '').trim().toLowerCase(); if (n === 'partielle') return 'partielle'; if (n === 'indisponible') return 'indisponible'; return this.readAvailability(email, disponible); }
  private readAvailability(email: string, disponible: boolean): AvailabilityState { try { const raw = localStorage.getItem(`smartassign_collab_profile_${email.toLowerCase()}`); if (!raw) return disponible ? 'disponible' : 'indisponible'; const p = JSON.parse(raw) as { disponibilite?: AvailabilityState }; return p.disponibilite ?? (disponible ? 'disponible' : 'indisponible'); } catch { return disponible ? 'disponible' : 'indisponible'; } }
  private mapTask(task: PlanningTaskDto): PlanningTask { return { id: String(task.id), title: task.titre, project: task.projetNom?.trim() || 'Sans projet', dueDate: new Date(task.dateEcheance), status: this.normalizeTaskStatus(task.statut), priority: this.normalizeTaskPriority(task.priorite) }; }
  private buildFallbackTasks(affectations: Affectation[]): PlanningTaskDto[] { return affectations.flatMap((a, i) => [{ id: a.id * 10 + 1, titre: 'Implementation sprint en cours', description: '', dateEcheance: this.isoDay(new Date(new Date(a.projet.dateDebut).setDate(new Date(a.projet.dateDebut).getDate() + 4 + i * 2))), statut: a.projet.statut === 'en_attente' ? 'A_FAIRE' : 'EN_COURS', priorite: a.score >= 85 ? 'HAUTE' : 'MOYENNE', projetId: a.projet.id, projetNom: a.projet.nom }, { id: a.id * 10 + 2, titre: 'Validation et revue fonctionnelle', description: '', dateEcheance: this.isoDay(new Date(new Date(a.projet.dateDebut).setDate(new Date(a.projet.dateDebut).getDate() + 9 + i * 2))), statut: a.projet.statut === 'termine' ? 'TERMINEE' : a.projet.statut === 'en_attente' ? 'BLOQUEE' : 'EN_COURS', priorite: 'MOYENNE', projetId: a.projet.id, projetNom: a.projet.nom }]).slice(0, 8); }
  private buildFallbackLeaves(state: AvailabilityState): PlanningLeaveDto[] { const y = this.today.getFullYear(); const m = this.today.getMonth(); if (state === 'indisponible') return [{ id: 1, libelle: 'Blocage planning', type: 'Indisponibilite declaree', dateDebut: this.isoDay(new Date(y, m, 8)), dateFin: this.isoDay(new Date(y, m, 12)), impactDisponibilite: 'INDISPONIBLE' }, { id: 2, libelle: 'Conge planifie', type: 'Absence planifiee', dateDebut: this.isoDay(new Date(y, m, 22)), dateFin: this.isoDay(new Date(y, m, 24)), impactDisponibilite: 'INDISPONIBLE' }]; if (state === 'partielle') return [{ id: 1, libelle: 'Disponibilite reduite', type: 'Disponibilite partielle', dateDebut: this.isoDay(new Date(y, m, 14)), dateFin: this.isoDay(new Date(y, m, 15)), impactDisponibilite: 'PARTIELLE' }]; return [{ id: 1, libelle: 'Buffer personnel', type: 'Jour reserve', dateDebut: this.isoDay(new Date(y, m, 26)), dateFin: this.isoDay(new Date(y, m, 26)), impactDisponibilite: 'AUTRE' }]; }
  private mapLeave(leave: PlanningLeaveDto): LeaveItem { return { id: String(leave.id), label: leave.libelle, type: leave.type, impact: this.normalizeLeaveImpact(leave.impactDisponibilite), startDate: new Date(leave.dateDebut), endDate: new Date(leave.dateFin) }; }
  private normalizeTaskStatus(value: string): PlanningTask['status'] { switch ((value || '').trim().toUpperCase()) { case 'EN_COURS': return 'En cours'; case 'BLOQUEE': case 'BLOQUE': return 'Bloquee'; case 'TERMINEE': case 'TERMINE': return 'Terminee'; default: return 'A faire'; } }
  private normalizeTaskPriority(value: string): PlanningTask['priority'] { switch ((value || '').trim().toUpperCase()) { case 'HAUTE': return 'Haute'; case 'BASSE': return 'Basse'; default: return 'Moyenne'; } }
  private normalizeLeaveImpact(value: string): LeaveItem['impact'] { switch ((value || '').trim().toUpperCase()) { case 'PARTIELLE': return 'PARTIELLE'; case 'INDISPONIBLE': return 'INDISPONIBLE'; default: return 'AUTRE'; } }
  private startOfMonth(date: Date): Date { return new Date(date.getFullYear(), date.getMonth(), 1); }
  private endOfMonth(date: Date): Date { return new Date(date.getFullYear(), date.getMonth() + 1, 0); }
  private startOfCalendarGrid(month: Date): Date { const s = this.startOfMonth(month); const dow = s.getDay(); const offset = dow === 0 ? 6 : dow - 1; return new Date(s.getFullYear(), s.getMonth(), s.getDate() - offset); }
  private overlapsRange(start: Date, end: Date, rs: Date, re: Date): boolean { return start <= re && end >= rs; }
  private isDateWithinRange(date: Date, rs: Date, re: Date): boolean { return date >= rs && date <= re; }
  private countOverlapDays(start: Date, end: Date, rs: Date, re: Date): number { const os = new Date(Math.max(start.getTime(), rs.getTime())); const oe = new Date(Math.min(end.getTime(), re.getTime())); if (os > oe) return 0; return Math.floor((this.stripTime(oe).getTime() - this.stripTime(os).getTime()) / 86400000) + 1; }
  private addDateRangeToSet(target: Set<string>, start: Date, end: Date): void { const cur = this.stripTime(start); const lim = this.stripTime(end); while (cur <= lim) { target.add(this.isoDay(cur)); cur.setDate(cur.getDate() + 1); } }
  private stripTime(date: Date): Date { return new Date(date.getFullYear(), date.getMonth(), date.getDate()); }
  private isoDay(date: Date): string { const d = this.stripTime(date); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; }
}