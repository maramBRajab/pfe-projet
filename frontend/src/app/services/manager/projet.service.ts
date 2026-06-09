import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import { Competence } from './competence.service';

export interface Projet {
  id?: number;
  nom: string;
  description: string;
  dateDebut: string;
  dateFin: string;
  statut: string;
  competencesRequises?: Competence[];
  managerNom?: string;
  nombreCollabs?: number;
  progression?: number;
}

export interface ProjetRequest {
  nom: string;
  description: string;
  dateDebut: string;
  dateFin: string;
  statut: string;
  competenceIds?: number[];
}

@Injectable({ providedIn: 'root' })
export class ProjetService {
  private url = `${environment.apiUrl}/projets`;

  constructor(private http: HttpClient) {}

  getAll(): Observable<Projet[]> {
    return this.http.get<Projet[]>(this.url);
  }

  getById(id: number): Observable<Projet> {
    return this.http.get<Projet>(`${this.url}/${id}`);
  }

  create(projet: ProjetRequest | Projet): Observable<Projet> {
    return this.http.post<Projet>(this.url, projet);
  }

  update(id: number, projet: ProjetRequest | Projet): Observable<Projet> {
    return this.http.put<Projet>(`${this.url}/${id}`, projet);
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${this.url}/${id}`);
  }
}
