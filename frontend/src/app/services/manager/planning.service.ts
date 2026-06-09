import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import { Affectation } from './affectation.service';
import { Collaborateur } from './collaborateur.service';

export interface PlanningTaskDto {
  id: number;
  titre: string;
  description: string;
  dateEcheance: string;
  statut: string;
  priorite: string;
  projetId?: number | null;
  projetNom?: string | null;
}

export interface PlanningLeaveDto {
  id: number;
  libelle: string;
  type: string;
  dateDebut: string;
  dateFin: string;
  impactDisponibilite: string;
}

export interface PlanningLeaveRequest {
  libelle: string;
  type: string;
  dateDebut: string;
  dateFin: string;
  impactDisponibilite: 'PARTIELLE' | 'INDISPONIBLE';
}

export interface CollaborateurPlanningDto {
  collaborateur: Collaborateur;
  disponibiliteEtat: string;
  disponibiliteMessage: string;
  affectations: Affectation[];
  taches: PlanningTaskDto[];
  conges: PlanningLeaveDto[];
}

export interface UtilisateurDisponibiliteDto {
  userId: number;
  statut: string;
}

@Injectable({ providedIn: 'root' })
export class PlanningService {
  private readonly url = `${environment.apiUrl}/planning`;

  constructor(private readonly http: HttpClient) {}

  getByCollaborateur(collaborateurId: number): Observable<CollaborateurPlanningDto> {
    return this.http.get<CollaborateurPlanningDto>(`${this.url}/collaborateur/${collaborateurId}`);
  }

  getTasksByCollaborateur(collaborateurId: number, dateDebut: string, dateFin: string): Observable<PlanningTaskDto[]> {
    return this.http.get<PlanningTaskDto[]>(`${environment.apiUrl}/collaborateurs/${collaborateurId}/taches`, {
      params: {
        date_debut: dateDebut,
        date_fin: dateFin,
      }
    });
  }

  getCongesByCollaborateur(collaborateurId: number): Observable<PlanningLeaveDto[]> {
    return this.http.get<PlanningLeaveDto[]>(`${environment.apiUrl}/collaborateurs/${collaborateurId}/conges`);
  }

  getDisponibiliteByUtilisateur(userId: number): Observable<UtilisateurDisponibiliteDto> {
    return this.http.get<UtilisateurDisponibiliteDto>(`${environment.apiUrl}/utilisateurs/${userId}/disponibilite`);
  }

  updateTaskStatus(collaborateurId: number, taskId: number, statut: 'EN_COURS' | 'TERMINE'): Observable<PlanningTaskDto> {
    return this.http.patch<PlanningTaskDto>(
      `${this.url}/collaborateur/${collaborateurId}/taches/${taskId}/statut`,
      { statut }
    );
  }

  createConge(collaborateurId: number, payload: PlanningLeaveRequest): Observable<PlanningLeaveDto> {
    return this.http.post<PlanningLeaveDto>(`${this.url}/collaborateur/${collaborateurId}/conges`, payload);
  }
}
