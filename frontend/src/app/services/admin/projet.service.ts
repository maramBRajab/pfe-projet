import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AuthService } from '../auth';

export interface Competence {
  id?: number;
  nom: string;
}

export type StatutProjet =
  | 'en_attente'
  | 'en_cours'
  | 'termine'
  | 'en_pause'
  | 'en_retard'
  | 'EN_COURS'
  | 'TERMINE'
  | 'EN_PAUSE'
  | 'EN_RETARD';

export interface Projet {
  id?:              number;
  nom:              string;
  description:      string;
  dateDebut:        string;
  dateFin:          string;
  statut:           StatutProjet;
  managerId?:       number;
  managerNom?:      string;
  nombreCollabs?:   number;
  progression?:     number;
  competencesRequises?: Competence[];
}

export interface ProjetRequest {
  nom:         string;
  description: string;
  dateDebut:   string;
  dateFin:     string;
  statut:      StatutProjet;
  managerId?:  number;
  competenceIds?: number[];
}

@Injectable({ providedIn: 'root' })
export class AdminProjetService {

  private readonly url = `${environment.apiUrl}/admin/projets`;

  constructor(
    private http: HttpClient,
    private authService: AuthService
  ) {}

  private get headers(): HttpHeaders {
    const token = this.authService.currentUser?.token ?? '';
    return new HttpHeaders({ Authorization: `Bearer ${token}` });
  }

  getAll(): Observable<Projet[]> {
    return this.http.get<Projet[]>(this.url, { headers: this.headers });
  }

  getById(id: number): Observable<Projet> {
    return this.http.get<Projet>(`${this.url}/${id}`, { headers: this.headers });
  }

  create(data: ProjetRequest): Observable<Projet> {
    return this.http.post<Projet>(this.url, data, { headers: this.headers });
  }

  update(id: number, data: ProjetRequest): Observable<Projet> {
    return this.http.put<Projet>(`${this.url}/${id}`, data, { headers: this.headers });
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${this.url}/${id}`, { headers: this.headers });
  }

  updateStatut(id: number, statut: StatutProjet): Observable<Projet> {
    return this.http.patch<Projet>(`${this.url}/${id}/statut`, { statut }, { headers: this.headers });
  }
}