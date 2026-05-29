import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';

export interface ManagerNotification {
  id: number;
  titre: string;
  description: string;
  temps: string;
  type: 'IA' | 'AFFECTATION' | 'VIGILANCE' | 'INFO' | 'CRITIQUE';
  lu: boolean;
  icon: string;
  iconBg: string;
  badgeClass: string;
}

@Injectable({ providedIn: 'root' })
export class ManagerNotificationApiService {

  private readonly baseUrl = `${environment.apiUrl}/manager/notifications`;

  constructor(private http: HttpClient) {}

  list(): Observable<ManagerNotification[]> {
    return this.http.get<ManagerNotification[]>(this.baseUrl);
  }
}
