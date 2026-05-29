import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';

export interface Competence {
  id?: number;
  nom: string;
}

@Injectable({ providedIn: 'root' })
export class CompetenceService {
  private url = `${environment.apiUrl}/competences`;

  constructor(private http: HttpClient) {}

  getAll(): Observable<Competence[]> {
    return this.http.get<Competence[]>(this.url);
  }

  getById(id: number): Observable<Competence> {
    return this.http.get<Competence>(`${this.url}/${id}`);
  }
}
