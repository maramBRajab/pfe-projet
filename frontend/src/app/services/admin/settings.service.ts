import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

// ── DTOs ──────────────────────────────────────────────────────────────────────

export interface AffectationsSettings {
  seuilCompatibilite:   number;
  maxProfilsRecommandes: number;
  matchingAutomatique:  boolean;
}

export interface PlateformeSettings {
  nomPlateforme:   string;
  modeMaintenance: boolean;
}

export interface MetaSettings {
  derniereModification: string | null;
  modifiePar:           string | null;
}

export interface SettingsDto {
  affectations: AffectationsSettings;
  plateforme:   PlateformeSettings;
  meta?:        MetaSettings;
}

export interface SettingsResponseDto {
  message:   string;
  updatedAt: string;
  settings:  SettingsDto;
}

// ── Service ───────────────────────────────────────────────────────────────────

@Injectable({ providedIn: 'root' })
export class AdminSettingsService {

  private readonly url = `${environment.apiUrl}/admin/settings`;

  constructor(private http: HttpClient) {}

  /** GET /api/admin/settings — récupère la configuration actuelle */
  getSettings(): Observable<SettingsDto> {
    return this.http.get<SettingsDto>(this.url);
  }

  /** PUT /api/admin/settings — persiste la configuration modifiée */
  updateSettings(data: SettingsDto): Observable<SettingsResponseDto> {
    return this.http.put<SettingsResponseDto>(this.url, data);
  }

  /** POST /api/admin/settings/reset — remet les valeurs par défaut */
  resetSettings(): Observable<SettingsResponseDto> {
    return this.http.post<SettingsResponseDto>(`${this.url}/reset`, {});
  }
}
