import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap } from 'rxjs';
import { environment } from '../../environments/environment';

export interface AuthUser {
  id:    number;
  nom:   string;
  email: string;
  role:  string;
  token: string;
}

export interface RegisterPayload {
  nom: string;
  prenom: string;
  email: string;
  motDePasse: string;
  experienceAnnees: number;
  disponible: boolean;
  competenceIds: number[];
}

export interface MessagePayload {
  message: string;
}

export interface CsrfTokenPayload {
  token: string;
  headerName: string;
  parameterName: string;
}

export interface NavbarPreferencesPayload {
  notificationsEnabled: boolean;
  urgentAlerts: boolean;
  projectUpdates: boolean;
  language: 'fr' | 'en' | 'ar';
  displayDensity: 'compact' | 'extended';
  theme: 'dark' | 'light';
}

export function normalizeUserRole(role: string | undefined | null): 'ADMIN' | 'MANAGER' | 'COLLAB' | '' {
  const normalizedRole = (role ?? '').toString().trim().toUpperCase();

  if (!normalizedRole) {
    return '';
  }

  if (normalizedRole.includes('ADMIN')) {
    return 'ADMIN';
  }

  if (normalizedRole.includes('MANAGER') || normalizedRole.includes('CHEF')) {
    return 'MANAGER';
  }

  if (normalizedRole.includes('COLLAB')) {
    return 'COLLAB';
  }

  return '';
}

export function getDefaultRouteForRole(role: string | undefined | null): string {
  switch (normalizeUserRole(role)) {
    case 'ADMIN':
      return '/admin/dashboard';
    case 'MANAGER':
      return '/manager/dashboard';
    case 'COLLAB':
      return '/collaborateurs/dashboard';
    default:
      return '/login';
  }
}

@Injectable({ providedIn: 'root' })
export class AuthService {

  private readonly url         = `${environment.apiUrl}/auth`;
  private readonly SESSION_KEY = 'smartassign_user';
  private readonly TOKEN_KEY   = 'token';

  constructor(private http: HttpClient) {}

  login(email: string, motDePasse: string): Observable<AuthUser> {
    return this.http
      .post<AuthUser>(`${this.url}/login`, { email, motDePasse })
      .pipe(
        tap(user => {
          localStorage.setItem(this.SESSION_KEY, JSON.stringify(user));
          localStorage.setItem(this.TOKEN_KEY, user.token);
        })
      );
  }

  register(payload: RegisterPayload): Observable<AuthUser> {
    return this.http
      .post<AuthUser>(`${this.url}/register`, payload)
      .pipe(
        tap(user => {
          localStorage.setItem(this.SESSION_KEY, JSON.stringify(user));
          localStorage.setItem(this.TOKEN_KEY, user.token);
        })
      );
  }

  initializeSecurity(): Observable<CsrfTokenPayload> {
    return this.http.get<CsrfTokenPayload>(`${this.url}/csrf-token`, {
      withCredentials: true
    });
  }

  forgotPassword(email: string): Observable<MessagePayload> {
    return this.http.post<MessagePayload>(`${this.url}/forgot-password`, {
      email
    });
  }

  validateResetPasswordToken(token: string): Observable<MessagePayload> {
    return this.http.get<MessagePayload>(`${this.url}/reset-password/validate`, {
      params: { token }
    });
  }

  resetPassword(token: string, motDePasse: string, confirmationMotDePasse: string): Observable<MessagePayload> {
    return this.http.post<MessagePayload>(`${this.url}/reset-password`, {
      token,
      motDePasse,
      confirmationMotDePasse
    });
  }

  getNavbarPreferences(): Observable<NavbarPreferencesPayload> {
    return this.http.get<NavbarPreferencesPayload>(`${this.url}/me/preferences`);
  }

  updateNavbarPreferences(payload: NavbarPreferencesPayload): Observable<NavbarPreferencesPayload> {
    return this.http.put<NavbarPreferencesPayload>(`${this.url}/me/preferences`, payload);
  }

  logout(): void {
    localStorage.removeItem(this.SESSION_KEY);
    localStorage.removeItem(this.TOKEN_KEY);
  }

  updateStoredUser(nom: string, email: string): void {
    const current = this.currentUser;
    if (!current) {
      return;
    }

    localStorage.setItem(this.SESSION_KEY, JSON.stringify({
      ...current,
      nom,
      email
    }));
  }

  get currentUser(): AuthUser | null {
    const data = localStorage.getItem(this.SESSION_KEY);
    if (!data) {
      return null;
    }

    try {
      const parsed = JSON.parse(data) as Partial<AuthUser>;
      if (!parsed?.email || !parsed?.token) {
        this.logout();
        return null;
      }

      return {
        ...(parsed as AuthUser),
        role: normalizeUserRole(parsed.role)
      };
    } catch {
      this.logout();
      return null;
    }
  }

  get isLoggedIn(): boolean {
    return !!this.currentUser;
  }

  get token(): string | null {
    return this.currentUser?.token ?? localStorage.getItem(this.TOKEN_KEY);
  }
}