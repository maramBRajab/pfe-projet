import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { AuditLog } from '../../features/admin/audit/audit.component';

@Injectable({ providedIn: 'root' })
export class AdminAuditService {
  private readonly apiUrl = '/api/admin/audit/logs';

  constructor(private http: HttpClient) {}

  getAuditLogs(): Observable<AuditLog[]> {
    return this.http.get<AuditLog[]>(this.apiUrl);
  }
}
