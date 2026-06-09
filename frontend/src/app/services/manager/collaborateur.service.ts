import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, catchError, map, throwError } from 'rxjs';

import { environment } from '../../../environments/environment';

import { Competence } from './competence.service';
import { Affectation } from './affectation.service';
export interface Collaborateur {
  id?: number;
  nom: string;
  prenom: string;
  email: string;
  telephone?: string;
  role?: string;
  departement?: string;
  photoUrl?: string | null;
  experienceAnnees: number;
  disponible: boolean;
  competences?: Competence[];
}

export interface CollaborateurRequest {
  nom: string;
  prenom: string;
  email: string;
  telephone?: string;
  photoUrl?: string | null;
  departement?: string;
  experienceAnnees: number;
  disponible: boolean;
  competenceIds?: number[];
}

export interface CollaborateurDashboardDisponibilite {
  etat: string;
  message: string;
  dateDebut: string | null;
  dateFin: string | null;
}

export interface CollaborateurDashboardJalon {
  projet: string;
  jalon: string;
  dateEcheance: string | null;
  statut: string;
  charge: number;
}

export interface CollaborateurDashboardPointsVigilance {
  count: number;
  entries: string[];
}

export interface CollaborateurDashboardActivite {
  initiales: string;
  action: string;
  temps: string;
  categorie: 'collab' | 'projet' | 'admin';
  createdAt: string | null;
}

export interface CollaborateurDashboardJournalEntry {
  action: string;
  date: string;
  details: string;
}

export interface CollaborateurDashboardResponse {
  collaborateurId: number;
  collaborateurNom: string;
  projetsActifs: number;
  disponibilite: CollaborateurDashboardDisponibilite;
  competencesCount: number;
  chargeMoyenne: number;
  prochainsJalons: CollaborateurDashboardJalon[];
  pointsVigilance: CollaborateurDashboardPointsVigilance;
  journalEntries: CollaborateurDashboardJournalEntry[];
  activiteRecente: CollaborateurDashboardActivite[];
}

export interface MesProjetsTacheDto {
  id?: number | null;
  titre: string;
  statut: string;
  priorite: string;
  dateEcheance: string;
  projetId: number | null;
  projetNom?: string | null;
}

export interface MesProjetsJalonDto {
  titre: string;
  date: string;
  statut: string;
  description: string;
}

export interface MesProjetsDto {
  projetsActifs: number;
  chargeActuelle: number;
  compatibiliteMoyenne: number;
  projetsTermines: number;
  taches: MesProjetsTacheDto[];
  jalons: MesProjetsJalonDto[];
}

export interface CollaborateurAffectationDto {
  id: number;
  projet: string;
  score: number;
  date_affectation: string;
  statut: string;
  manager_nom: string | null;
}

export type CollaborateurNotificationType = 'CRITIQUE' | 'VIGILANCE' | 'INFO';

export interface CollaborateurNotificationDto {
  id: number;
  type: CollaborateurNotificationType;
  titre: string;
  description: string;
  date: string;
  notificationKey: string;
  lu: boolean;
}

export interface CollaborateurNotificationSummaryDto {
  totalAlertes: number;
  informations: number;
  vigilances: number;
  critiques: number;
  notifications: CollaborateurNotificationDto[];
}

@Injectable({ providedIn: 'root' })
export class CollaborateurService {
  private url = `${environment.apiUrl}/collaborateurs`;

  constructor(private http: HttpClient) {}

  getAll(): Observable<Collaborateur[]> {
    return this.http.get<Collaborateur[]>(this.url);
  }

  getDisponibles(): Observable<Collaborateur[]> {
    return this.http.get<Collaborateur[]>(`${this.url}/disponibles`);
  }

  getById(id: number): Observable<Collaborateur> {
    return this.http.get<Collaborateur>(`${this.url}/${id}`);
  }

  getCollaborateur(id: number): Observable<Collaborateur> {
    return this.getById(id);
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

  getDashboard(id: number): Observable<CollaborateurDashboardResponse> {
    return this.http.get<CollaborateurDashboardResponse>(`${this.url}/${id}/dashboard`);
  }

  getRecentActivities(id: number) {
    return this.getDashboard(id).pipe(map((dashboard) => dashboard.activiteRecente));
  }

  getProjetsActifs(id: number) {
    return this.getDashboard(id).pipe(map((dashboard) => dashboard.projetsActifs));
  }

  getCompetences(id: number) {
    return this.getDashboard(id).pipe(map((dashboard) => dashboard.competencesCount));
  }

  getCharge(id: number) {
    return this.getDashboard(id).pipe(map((dashboard) => dashboard.chargeMoyenne));
  }

  getProchainJalon(id: number) {
    return this.getDashboard(id).pipe(map((dashboard) => dashboard.prochainsJalons[0] ?? null));
  }

  getMesProjets(id: number): Observable<MesProjetsDto> {
    return this.http.get<MesProjetsDto>(`${this.url}/${id}/mes-projets`);
  }

  getHistorique(id: number): Observable<Affectation[]> {
    return this.http.get<Affectation[]>(`${this.url}/${id}/historique`);
  }

  getAffectations(id: number): Observable<CollaborateurAffectationDto[]> {
    return this.http.get<CollaborateurAffectationDto[]>(`${this.url}/${id}/affectations`);
  }

  getNotifications(id: number): Observable<CollaborateurNotificationSummaryDto> {
    return this.http.get<CollaborateurNotificationSummaryDto>(`${this.url}/${id}/notifications`);
  }

  dismissNotification(id: number, key: string): Observable<void> {
    return this.http.post<void>(`${this.url}/${id}/notifications/${encodeURIComponent(key)}/dismiss`, {});
  }

  markAllNotificationsRead(id: number): Observable<void> {
    return this.http.post<void>(`${this.url}/${id}/notifications/mark-all-read`, {});
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
