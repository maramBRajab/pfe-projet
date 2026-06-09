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
  telephone?:        string;
  role:              string;
  departement?:      string;
  motDePasseGenere?: string;
  emailEnvoye?:      boolean;
  emailErreur?:      string;
  emailVerifie?:     boolean;
  emailVerifieLe?:   string;
  statutVerificationEmail?: 'VERIFIE' | 'NON_VERIFIE';
  verificationEmailEnvoye?: boolean;
  verificationEmailErreur?: string;
  statutCompte?:     'ACTIF' | 'SUSPENDU' | 'EN_ATTENTE_VERIFICATION';
  experienceAnnees:  number;
  disponible:        boolean;
  competences?:      Competence[];
}

export interface CollaborateurRequest {
  nom:               string;
  prenom:            string;
  email?:            string;
  telephone?:        string;
  motDePasse?:       string;
  role:              string;
  departement?:      string;
  experienceAnnees:  number;
  disponible:        boolean;
  competenceIds?:    number[];
}

@Injectable({ providedIn: 'root' })
export class AdminCollaborateurService {

  private readonly url = `${environment.apiUrl}/collaborateurs`;
  private readonly usersUrl = `${environment.apiUrl}/admin/utilisateurs`;

  constructor(private http: HttpClient) {}

  getAll(): Observable<Collaborateur[]> {
    return this.http.get<Collaborateur[]>(this.usersUrl);
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

  updateStatut(id: number, statut: 'ACTIF' | 'SUSPENDU'): Observable<Collaborateur> {
    return this.http.patch<Collaborateur>(`${this.usersUrl}/${id}/statut`, { statut });
  }

  renvoyerIdentifiants(email: string): Observable<any> {
    const authUrl = `${environment.apiUrl}/auth/renvoyer-identifiants`;
    return this.http.post<any>(authUrl, { email });
  }

  renvoyerVerificationEmail(id: number): Observable<any> {
    return this.http.post<any>(`${this.url}/${id}/renvoyer-verification`, {});
  }
}