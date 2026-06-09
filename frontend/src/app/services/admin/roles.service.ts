import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';

export interface RolePermission {
  id: string;
  label: string;
  granted: boolean;
}

export interface RoleMember {
  id: number;
  nom: string;
  prenom?: string;
  email: string;
  role: string;
  statutCompte?: 'ACTIF' | 'SUSPENDU' | string;
}

export interface AdminRole {
  id: string;
  code: string;
  name: string;
  description: string;
  icon: 'admin' | 'manager' | 'collab' | string;
  color: 'violet' | 'blue' | 'green' | string;
  usersCount: number;
  systemRole: boolean;
  permissions: RolePermission[];
  members: RoleMember[];
}

@Injectable({ providedIn: 'root' })
export class AdminRolesService {
  private readonly url = `${environment.apiUrl}/admin/roles`;

  constructor(private readonly http: HttpClient) {}

  getRoles(): Observable<AdminRole[]> {
    return this.http.get<AdminRole[]>(this.url);
  }
}
