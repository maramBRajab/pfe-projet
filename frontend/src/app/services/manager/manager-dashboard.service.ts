import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';

export interface ManagerDashboardStats {
  projetsActifs: number;
  ressourcesDisponibles: number;
  affectationsEnCours: number;
  tauxAffectation: number;
  alertesPrioritaires: number;
  compatibiliteIa: number;
  totalCollaborateurs: number;
  projetsEnRetard: number;
  collaborateursSurcharges: number;
}

export interface ManagerDashboardAlert {
  type: 'warning' | 'danger' | 'info' | string;
  title: string;
  description: string;
  link: string;
}

export interface ManagerDashboardAlertsResponse {
  total: number;
  items: ManagerDashboardAlert[];
}

@Injectable({ providedIn: 'root' })
export class ManagerDashboardService {
  private readonly url = `${environment.apiUrl}/dashboard/manager`;

  constructor(private readonly http: HttpClient) {}

  getStats(): Observable<ManagerDashboardStats> {
    return this.http.get<ManagerDashboardStats>(`${this.url}/stats`);
  }

  getPriorityAlerts(): Observable<ManagerDashboardAlertsResponse> {
    return this.http.get<ManagerDashboardAlertsResponse>(`${this.url}/alertes-prioritaires`);
  }
}
