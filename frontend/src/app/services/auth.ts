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
  photoUrl?: string | null;
  telephone?: string;
  poste?: string;
  departement?: string;
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
  private cachedUser: AuthUser | null = null;

  constructor(private http: HttpClient) {}

  login(email: string, motDePasse: string): Observable<AuthUser> {
    return this.http
      .post<AuthUser>(`${this.url}/login`, { email, motDePasse })
      .pipe(
        tap(user => {
          this.cachedUser = user;
          localStorage.setItem(this.TOKEN_KEY, user.token);
          localStorage.removeItem(this.SESSION_KEY);
        })
      );
  }

  register(payload: RegisterPayload): Observable<AuthUser> {
    return this.http
      .post<AuthUser>(`${this.url}/register`, payload)
      .pipe(
        tap(user => {
          this.cachedUser = user;
          localStorage.setItem(this.TOKEN_KEY, user.token);
          localStorage.removeItem(this.SESSION_KEY);
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
    this.cachedUser = null;
    localStorage.removeItem(this.SESSION_KEY);
    localStorage.removeItem(this.TOKEN_KEY);
  }

  updateStoredUser(nom: string, email: string): void {
    const current = this.currentUser;
    if (!current) {
      return;
    }

    this.cachedUser = { ...current, nom, email };
  }

  updateCurrentUser(data: Partial<{ nom: string; email: string; telephone: string; poste: string; photoUrl: string }>): void {
    const current = this.currentUser;
    if (!current) {
      return;
    }

    const updated = { ...current, ...data };
    this.cachedUser = updated;
  }

  getCurrentProfile(): Observable<AuthUser> {
    return this.http.get<AuthUser>(`${this.url}/me/profile`).pipe(
      tap((profile) => {
        const token = this.token;
        this.cachedUser = {
          ...profile,
          token: profile.token || token || ''
        };
      })
    );
  }

  updateProfile(payload: {
    nom: string;
    email: string;
    photoUrl?: string | null;
    telephone?: string;
    poste?: string;
    departement?: string;
  }): Observable<AuthUser> {
    return this.http
      .put<AuthUser>(
        `${this.url}/me/profile`,
        payload
      )
      .pipe(
        tap((res) => {
          const token = this.token;
          this.cachedUser = {
            ...res,
            token: res.token || token || ''
          };
        })
      );
  }

  changePassword(payload: {
    motDePasseActuel: string;
    nouveauMotDePasse: string;
    confirmationMotDePasse: string;
  }): Observable<{ message: string }> {
    return this.http.put<{ message: string }>(
      `${this.url}/me/password`,
      payload
    );
  }

  get currentUser(): AuthUser | null {
    if (this.cachedUser) {
      return {
        ...this.cachedUser,
        role: normalizeUserRole(this.cachedUser.role)
      };
    }

    const token = localStorage.getItem(this.TOKEN_KEY);
    if (!token) {
      localStorage.removeItem(this.SESSION_KEY);
      return null;
    }

    const parsed = this.decodeToken(token);
    if (parsed?.email && parsed?.role) {
      return {
        id: Number(parsed.id ?? 0),
        nom: parsed.nom ?? '',
        email: parsed.email,
        token,
        role: normalizeUserRole(parsed.role)
      };
    }

    this.logout();
    return null;
  }

  get isLoggedIn(): boolean {
    return !!this.currentUser;
  }

  get token(): string | null {
    return this.cachedUser?.token ?? localStorage.getItem(this.TOKEN_KEY);
  }

  private decodeToken(token: string): Partial<AuthUser> | null {
    try {
      const payload = token.split('.')[1];
      if (!payload) {
        return null;
      }

      const normalizedPayload = payload.replace(/-/g, '+').replace(/_/g, '/');
      const paddedPayload = normalizedPayload.padEnd(Math.ceil(normalizedPayload.length / 4) * 4, '=');
      const decoded = JSON.parse(atob(paddedPayload));
      return {
        email: decoded.sub,
        role: decoded.role,
        nom: decoded.nom,
        id: decoded.id
      };
    } catch {
      return null;
    }
  }
}
