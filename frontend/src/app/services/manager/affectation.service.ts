import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

import { environment } from '../../../environments/environment';
import { Collaborateur } from './collaborateur.service';
import { Competence } from './competence.service';
import { Projet } from './projet.service';

export interface Affectation {
  id: number;
  projet: Projet;
  collaborateur: Collaborateur;
  score: number;
  potentiel?: string;
  dateAffectation: string;
}

export interface ResultatAffectation {
  id: number;
  nom: string;
  prenom: string;
  email: string;
  experienceAnnees: number;
  disponible: boolean;
  score: number;
  competences: Competence[];
}

export interface AffectationCreateRequest {
  collaborateurId: number;
  projetId: number;
  score?: number;
}

@Injectable({ providedIn: 'root' })
export class AffectationService {

  private readonly url = `${environment.apiUrl}/affectations`;

  constructor(private http: HttpClient) {}

  affecter(projetId: number): Observable<ResultatAffectation[]> {
    return this.http
      .post<Affectation[]>(`${this.url}/lancer/${projetId}`, {})
      .pipe(
        map((affectations) => affectations
          .sort((a, b) => b.score - a.score)
          .map((affectation) => ({
            id: affectation.collaborateur.id ?? 0,
            nom: affectation.collaborateur.nom,
            prenom: affectation.collaborateur.prenom,
            email: affectation.collaborateur.email,
            experienceAnnees: affectation.collaborateur.experienceAnnees,
            disponible: affectation.collaborateur.disponible,
            score: affectation.score,
            competences: affectation.collaborateur.competences ?? []
          })))
      );
  }

  getAll(): Observable<Affectation[]> {
    return this.http.get<Affectation[]>(this.url);
  }

  create(payload: AffectationCreateRequest): Observable<Affectation> {
    return this.http.post<Affectation>(this.url, payload);
  }

  getByProjet(projetId: number): Observable<Affectation[]> {
    return this.http.get<Affectation[]>(`${this.url}/projet/${projetId}`);
  }

  getByCollaborateur(id: number): Observable<Affectation[]> {
    return this.http.get<Affectation[]>(`${this.url}/collaborateur/${id}`);
  }

  getById(id: number): Observable<Affectation> {
    return this.http.get<Affectation>(`${this.url}/${id}`);
  }

  update(id: number, payload: { collaborateurId: number }): Observable<Affectation> {
    return this.http.put<Affectation>(`${this.url}/${id}`, payload);
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${this.url}/${id}`);
  }
}
