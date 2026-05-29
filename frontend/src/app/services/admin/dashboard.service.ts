import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';

export interface DashboardStats {
  projetsActifs: number;
  totalCollaborateurs: number;
  tauxAffectation: number;
  managersActifs: number;
  totalManagers: number;
  projetsEnRetard: number;
  ressourcesDisponibles: number;
  nouveauxProjets: number;
  nouveauxCollabs: number;
}

export interface EvolutionMois {
  mois: string;
  actifs: number;
  termines: number;
}

export interface RepartitionRoles {
  collaborateurs: number;
  managers: number;
  admins: number;
}

export interface Alerte {
  type: string;
  icon: string;
  message: string;
  time: string;
}

export interface Activite {
  initiales: string;
  action: string;
  temps: string;
  categorie: string;
}

export interface HealthFactor {
  label: string;
  score: number;
  tone: 'good' | 'watch' | 'risk';
  detail: string;
}

export interface PlatformHealth {
  score: number;
  label: string;
  summary: string;
  tone: 'good' | 'watch' | 'risk';
  factors: HealthFactor[];
}

export interface CriticalProject {
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
  tone: 'good' | 'watch' | 'risk';
}

export interface UpcomingDeadline {
  id?: number;
  nom: string;
  owner: string;
  dueLabel: string;
  daysLeft: number;
  tone: 'good' | 'watch' | 'risk';
  link: string;
}

export interface CollaboratorLoad {
  id?: number;
  name: string;
  role: string;
  load: number;
  assignmentCount: number;
  activeProjects: number;
  availabilityLabel: string;
  skills: string;
  tone: 'good' | 'watch' | 'risk';
  link: string;
}

export interface Suggestion {
  title: string;
  detail: string;
  actionLabel: string;
  link: string;
  tone: 'good' | 'watch' | 'risk';
}

export interface DashboardInsights {
  platformHealth: PlatformHealth;
  criticalProjects: CriticalProject[];
  upcomingDeadlines: UpcomingDeadline[];
  collaboratorLoad: CollaboratorLoad[];
  suggestions: Suggestion[];
}

export interface SearchResult {
  type: 'Projet' | 'Utilisateur';
  title: string;
  subtitle: string;
  link: string;
}

@Injectable({ providedIn: 'root' })
export class AdminDashboardService {
  private readonly url = `${environment.apiUrl}/dashboard/admin`;

  constructor(private readonly http: HttpClient) {}

  getStats(): Observable<DashboardStats> {
    return this.http.get<DashboardStats>(`${this.url}/stats`);
  }

  getEvolutionProjets(): Observable<EvolutionMois[]> {
    return this.http.get<EvolutionMois[]>(`${this.url}/evolution-projets`);
  }

  getRepartitionRoles(): Observable<RepartitionRoles> {
    return this.http.get<RepartitionRoles>(`${this.url}/repartition-roles`);
  }

  getAlertes(): Observable<Alerte[]> {
    return this.http.get<Alerte[]>(`${this.url}/alertes`);
  }

  getActiviteRecente(): Observable<Activite[]> {
    return this.http.get<Activite[]>(`${this.url}/activite-recente`);
  }

  getInsights(): Observable<DashboardInsights> {
    return this.http.get<DashboardInsights>(`${this.url}/insights`);
  }

  search(query: string): Observable<SearchResult[]> {
    return this.http.get<SearchResult[]>(`${this.url}/search`, {
      params: { query }
    });
  }
}