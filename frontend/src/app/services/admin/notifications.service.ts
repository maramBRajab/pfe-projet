import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { map, Observable } from 'rxjs';

import { environment } from '../../../environments/environment';

export type AdminNotificationType = 'VIGILANCE' | 'CRITIQUE' | 'INFO';

export interface AdminNotificationItem {
  id: number;
  type: AdminNotificationType;
  titre: string;
  description: string;
  isRead: boolean;
  read?: boolean;
  createdAt: string;
  projetId?: number;
  projetNom?: string;
}

export interface AdminNotificationsStats {
  total: number;
  vigilances: number;
  critiques: number;
  informations: number;
  nonLues: number;
}

export interface AdminNotificationsResponse {
  notifications: AdminNotificationItem[];
  stats: AdminNotificationsStats;
}

@Injectable({ providedIn: 'root' })
export class AdminNotificationsService {
  private readonly url = `${environment.apiUrl}/admin/notifications`;

  constructor(private readonly http: HttpClient) {}

  getAll(): Observable<AdminNotificationsResponse> {
    return this.http.get<AdminNotificationsResponse>(this.url).pipe(
      map((response) => ({
        ...response,
        notifications: (response?.notifications ?? []).map((notification) => ({
          ...notification,
          isRead: Boolean(notification.isRead ?? notification.read)
        }))
      }))
    );
  }

  getUnreadCount(): Observable<{ count: number }> {
    return this.http.get<{ count: number }>(`${this.url}/unread-count`);
  }

  markAsRead(id: number): Observable<{ message: string }> {
    return this.http.put<{ message: string }>(`${this.url}/${id}/read`, {});
  }

  markAllAsRead(): Observable<{ message: string }> {
    return this.http.put<{ message: string }>(`${this.url}/mark-all-read`, {});
  }

  delete(id: number): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(`${this.url}/${id}`);
  }
}
