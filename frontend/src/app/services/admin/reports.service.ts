import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';

export interface SystemReportComptes {
  total: number;
  ceMois: number;
  moisDernier: number;
  suspendus: number;
}

export interface SystemReportConnexions {
  actives: number;
  evolution: number;
}

export interface SystemReportAffectation {
  tauxGlobal: number;
  cible: number;
}

export interface SystemReportProjets {
  total: number;
  enCours: number;
  enAttente: number;
  termines: number;
}

export interface SystemReportSante {
    uptimePlateforme: number;
    tauxAffectation: number;
    tauxProjetsActifs: number;
    tauxCollaborateursAffectes: number;
  comptesAvecCompetences: number;
}

export interface EvolutionMoisReport {
  mois: string;
  count: number;
}

export interface RepartitionDept {
  departement: string;
  count: number;
}

export interface SystemReport {
  comptesCrees: SystemReportComptes;
  connexions: SystemReportConnexions;
  affectation: SystemReportAffectation;
  projets: SystemReportProjets;
  santeSysteme: SystemReportSante;
  evolutionComptes: EvolutionMoisReport[];
  repartitionDepartement: RepartitionDept[];
}

@Injectable({ providedIn: 'root' })
export class AdminReportsService {
  private readonly url = `${environment.apiUrl}/admin/reports`;

  constructor(private readonly http: HttpClient) {}

  getSystemReport(): Observable<SystemReport> {
    return this.http.get<SystemReport>(`${this.url}/system`);
  }
}
