import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface Competence {
  id?:  number;
  nom:  string;
}

export interface Collaborateur {
  id?:               number;
  nom:               string;
  prenom:            string;
  email:             string;
  role:              string;
  motDePasseGenere?: string;
  experienceAnnees:  number;
  disponible:        boolean;
  competences?:      Competence[];
}

export interface CollaborateurRequest {
  nom:               string;
  prenom:            string;
  email?:            string;
  motDePasse?:       string;
  role:              string;
  experienceAnnees:  number;
  disponible:        boolean;
  competenceIds?:    number[];
}

@Injectable({ providedIn: 'root' })
export class AdminCollaborateurService {

  private readonly url = `${environment.apiUrl}/collaborateurs`;

  constructor(private http: HttpClient) {}

  getAll(): Observable<Collaborateur[]> {
    return this.http.get<Collaborateur[]>(this.url);
  }

  getById(id: number): Observable<Collaborateur> {
    return this.http.get<Collaborateur>(`${this.url}/${id}`);
  }

  create(data: CollaborateurRequest): Observable<Collaborateur> {
    return this.http.post<Collaborateur>(this.url, data);
  }

  update(id: number, data: CollaborateurRequest): Observable<Collaborateur> {
    return this.http.put<Collaborateur>(`${this.url}/${id}`, data);
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${this.url}/${id}`);
  }

  toggleDisponibilite(id: number): Observable<Collaborateur> {
    return this.http.patch<Collaborateur>(`${this.url}/${id}/disponibilite`, {});
  }
}