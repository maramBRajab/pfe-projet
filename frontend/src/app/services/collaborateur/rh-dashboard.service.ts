import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';

export interface RhJalon {
  id: number;
  titre: string;
  description: string;
  date: string;
  statut: string;
  userId: number;
}

export interface RhActivite {
  id: number;
  type: string;
  message: string;
  date: string;
  userId: number;
}

export interface RhJournal {
  id: number;
  action: string;
  utilisateur: string;
  date: string;
  details: string;
}

export interface RhDisponibilite {
  userId: number;
  statut: string;
}

@Injectable({ providedIn: 'root' })
export class RhDashboardService {
  private readonly apiUrl = environment.apiUrl;

  constructor(private readonly http: HttpClient) {}

  getJalons(userId?: number): Observable<RhJalon[]> {
    return this.http.get<RhJalon[]>(`${this.apiUrl}/jalons`, {
      params: userId ? { user_id: userId, userId } : {}
    });
  }

  getActivites(userId?: number): Observable<RhActivite[]> {
    return this.http.get<RhActivite[]>(`${this.apiUrl}/activites`, {
      params: userId ? { userId } : {}
    });
  }

  getJournal(): Observable<RhJournal[]> {
    return this.http.get<RhJournal[]>(`${this.apiUrl}/journal`);
  }

  getDisponibilites(): Observable<RhDisponibilite[]> {
    return this.http.get<RhDisponibilite[]>(`${this.apiUrl}/utilisateurs/disponibilite`);
  }

  generateTestData(): Observable<void> {
    return this.http.post<void>(`${this.apiUrl}/dashboard-rh/generate-test-data`, {});
  }
}