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

export interface CollaborateurPlanningDto {
  collaborateur: Collaborateur;
  disponibiliteEtat: string;
  disponibiliteMessage: string;
  affectations: Affectation[];
  taches: PlanningTaskDto[];
  conges: PlanningLeaveDto[];
}

@Injectable({ providedIn: 'root' })
export class PlanningService {
  private readonly url = `${environment.apiUrl}/planning`;

  constructor(private readonly http: HttpClient) {}

  getByCollaborateur(collaborateurId: number): Observable<CollaborateurPlanningDto> {
    return this.http.get<CollaborateurPlanningDto>(`${this.url}/collaborateur/${collaborateurId}`);
  }
}
