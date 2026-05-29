import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, catchError, map, throwError } from 'rxjs';

import { environment } from '../../../environments/environment';
import { Competence } from './competence.service';

export interface Collaborateur {
  id?: number;
  nom: string;
  prenom: string;
  email: string;
  experienceAnnees: number;
  disponible: boolean;
  competences?: Competence[];
}

export interface CollaborateurRequest {
  nom: string;
  prenom: string;
  email: string;
  experienceAnnees: number;
  disponible: boolean;
  competenceIds?: number[];
}

@Injectable({ providedIn: 'root' })
export class CollaborateurService {
  private url = `${environment.apiUrl}/collaborateurs`;

  constructor(private http: HttpClient) {}

  getAll(): Observable<Collaborateur[]> {
    return this.http.get<Collaborateur[]>(this.url);
  }

  getById(id: number): Observable<Collaborateur> {
    return this.http.get<Collaborateur>(`${this.url}/${id}`);
  }

  getByEmail(email: string): Observable<Collaborateur> {
    const normalizedEmail = email.trim().toLowerCase();

    return this.http.get<Collaborateur>(`${this.url}/search/by-email`, {
      params: { email: email.trim() }
    }).pipe(
      catchError(() => this.getAll().pipe(
        map((collaborateurs) => {
          const collaborateur = collaborateurs.find((item) => item.email.trim().toLowerCase() === normalizedEmail);

          if (!collaborateur) {
            throw new Error(`Collaborateur introuvable pour l'email : ${email}`);
          }

          return collaborateur;
        }),
        catchError(() => throwError(() => new Error(`Collaborateur introuvable pour l'email : ${email}`)))
      ))
    );
  }

  create(collaborateur: CollaborateurRequest): Observable<Collaborateur> {
    return this.http.post<Collaborateur>(this.url, collaborateur);
  }

  update(id: number, collaborateur: CollaborateurRequest): Observable<Collaborateur> {
    return this.http.put<Collaborateur>(`${this.url}/${id}`, collaborateur);
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${this.url}/${id}`);
  }
}
