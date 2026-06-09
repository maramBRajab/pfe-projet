import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';

export interface ManagerIaAnalyseRequest {
  question: string;
}

export interface ManagerIaAnalyseResponse {
  reponse: string;
}

@Injectable({ providedIn: 'root' })
export class ManagerIaService {
  private readonly url = `${environment.apiUrl}/manager/ia/analyse`;

  constructor(private readonly http: HttpClient) {}

  analyse(question: string): Observable<ManagerIaAnalyseResponse> {
    return this.http.post<ManagerIaAnalyseResponse>(this.url, { question } as ManagerIaAnalyseRequest);
  }
}
