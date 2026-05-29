import { Component, HostListener, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { Subscription, filter } from 'rxjs';
import { AuthService, AuthUser, NavbarPreferencesPayload } from './services/auth';
import { ChatbotComponent } from './shared/chatbot/chatbot.component';

interface NavItem {
  label: string;
  icon: string;
  link?: string;
  exact?: boolean;
  soon?: boolean;
}

interface NavSection {
  title: string;
  items: NavItem[];
}

interface CollabNotificationItem {
  title: string;
  description: string;
  time: string;
  tone: 'orange' | 'green' | 'blue';
}

interface CollabNotificationPayload {
  type: string;
  titre: string;
  message: string;
  niveau: string;
  dateCreation: string;
}

interface CollabNavbarPreferences {
  notificationsEnabled: boolean;
  urgentAlerts: boolean;
  projectUpdates: boolean;
  language: 'fr' | 'en' | 'ar';
  displayDensity: 'compact' | 'extended';
  theme: 'dark' | 'light';
}

interface CollabExportOptions {
  projects: boolean;
  planning: boolean;
  metrics: boolean;
}

type ExportFormat = 'pdf' | 'excel';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterOutlet, ChatbotComponent],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class AppComponent implements OnInit, OnDestroy {
  private readonly preloadedRoles = new Set<string>();
  private readonly collabPreferencesStorageKey = 'smartassign-collab-navbar-preferences';
  private readonly collabExportStorageKey = 'smartassign-collab-export-options';
  private notificationSub?: Subscription;
  private hasLoadedRemoteCollabPreferences = false;
  private collabNotificationSource?: {
    notifications$: { subscribe: (callback: (notification: CollabNotificationPayload) => void) => Subscription };
    getSnapshot: () => CollabNotificationPayload[];
    ngOnDestroy?: () => void;
  };

  userName      = '';
  userInitiales = '';
  userRole      = '';
  isCollabModeOff = false;
  isCollabNotifOpen = false;
  isCollabSettingsOpen = false;
  isCollabExportOpen = false;
  selectedExportFormat: ExportFormat = 'pdf';
  collabSearchTerm = '';
  isUserMenuOpen = false;
  sidebarSections: NavSection[] = [];
  collabNotificationFeed: CollabNotificationPayload[] = [];
  collabPreferences: CollabNavbarPreferences = {
    notificationsEnabled: true,
    urgentAlerts: true,
    projectUpdates: true,
    language: 'fr',
    displayDensity: 'extended',
    theme: 'dark'
  };
  collabExportOptions: CollabExportOptions = {
    projects: true,
    planning: true,
    metrics: true
  };

  constructor(
    private authService: AuthService,
    private router: Router
  ) {}

  get isLoggedIn(): boolean {
    return this.authService.isLoggedIn;
  }

  get canManageResources(): boolean {
    return this.userRole === 'ADMIN' || this.userRole === 'MANAGER';
  }

  get isCollaborateurRole(): boolean {
    return this.userRole === 'COLLAB';
  }

  get isAdminRole(): boolean {
    return this.userRole === 'ADMIN';
  }

  get roleBadgeLabel(): string {
    switch (this.userRole) {
      case 'ADMIN':
        return 'Administrateur';
      case 'MANAGER':
        return 'Manager';
      case 'COLLAB':
        return 'Collaborateur';
      default:
        return 'Utilisateur';
    }
  }

  get currentProfileLink(): string {
    switch (this.userRole) {
      case 'ADMIN':
        return '/admin/profil';
      case 'MANAGER':
        return '/manager/profil';
      case 'COLLAB':
        return '/mon-profil';
      default:
        return '/dashboard';
    }
  }

  get displayUserName(): string {
    return this.userName || 'Admin Principal';
  }

  get displayUserInitiales(): string {
    return this.userInitiales || 'AP';
  }

  get isCollabDashboardActive(): boolean {
    return this.router.url.split('?')[0] === '/collaborateurs/collaborateurs/dashboard';
  }

  get isCollabProjectsActive(): boolean {
    return this.router.url.split('?')[0] === '/mes-projets';
  }

  get isCollabPlanningActive(): boolean {
    return this.router.url.split('?')[0] === '/planning';
  }

  get isCollabHistoryActive(): boolean {
    return this.router.url.split('?')[0] === '/historique';
  }

  get isCollaborateurWorkspaceRoute(): boolean {
    const path = this.router.url.split('?')[0];

    return this.userRole === 'COLLAB' && [
      '/collaborateurs/dashboard',
      '/mes-projets',
      '/planning',
      '/historique',
      '/mon-profil',
      '/notifications'
    ].includes(path);
  }

  get isManagerWorkspaceRoute(): boolean {
    const path = this.router.url.split('?')[0];
    return this.userRole === 'MANAGER' && path.startsWith('/manager');
  }

  get isLandingRoute(): boolean {
    return this.router.url.split('?')[0] === '/';
  }

  get isCollabCompactMode(): boolean {
    return this.collabPreferences.displayDensity === 'compact';
  }

  get collabNotifications(): CollabNotificationItem[] {
    if (!this.collabPreferences.notificationsEnabled) {
      return [];
    }

    return this.collabNotificationFeed
      .filter((notification) => this.shouldDisplayCollabNotification(notification))
      .slice(0, 5)
      .map((notification) => ({
        title: notification.titre,
        description: notification.message,
        time: this.formatRelativeTime(notification.dateCreation),
        tone: this.mapCollabNotificationTone(notification)
      }));
  }

  get collabNotificationCount(): number {
    return this.collabNotifications.length;
  }

  ngOnInit(): void {
    this.loadCollabPreferences();
    this.loadCollabExportOptions();
    this.syncCollabSearchFromRoute();
    this.loadUser();
    void this.initializeCollabNotifications();
    this.router.events
      .pipe(filter((event) => event instanceof NavigationEnd))
      .subscribe(() => {
        this.isUserMenuOpen = false;
        this.isCollabNotifOpen = false;
        this.isCollabSettingsOpen = false;
        this.isCollabExportOpen = false;
        this.syncCollabSearchFromRoute();
        this.loadUser();
      });
  }

  ngOnDestroy(): void {
    this.notificationSub?.unsubscribe();
    this.collabNotificationSource?.ngOnDestroy?.();
  }

  @HostListener('document:click')
  onDocumentClick(): void {
    this.isUserMenuOpen = false;
    this.isCollabNotifOpen = false;
  }

  loadUser(): void {
    const user: AuthUser | null = this.authService.currentUser;
    if (user) {
      this.userName      = user.nom;
      this.userRole      = user.role;
      this.userInitiales = user.nom
        .split(' ')
        .map((p: string) => p[0] ?? '')
        .join('')
        .slice(0, 2)
        .toUpperCase();
      this.sidebarSections = this.buildSidebarSections(user.role);
      this.preloadRoleRoutes(user.role);
      if (this.userRole === 'COLLAB' && !this.hasLoadedRemoteCollabPreferences) {
        this.loadCollabPreferencesFromServer();
      }
      if (this.userRole === 'COLLAB' && !this.collabNotificationSource) {
        void this.initializeCollabNotifications();
      }
      return;
    }

    this.userName = '';
    this.userRole = '';
    this.userInitiales = '';
    this.sidebarSections = [];
    this.notificationSub?.unsubscribe();
    this.notificationSub = undefined;
    this.collabNotificationSource?.ngOnDestroy?.();
    this.collabNotificationSource = undefined;
    this.collabNotificationFeed = [];
    this.hasLoadedRemoteCollabPreferences = false;
  }

  logout(): void {
    this.isUserMenuOpen = false;
    this.authService.logout();
    this.router.navigate(['/login']);
  }

  toggleUserMenu(event: MouseEvent): void {
    event.stopPropagation();
    this.isUserMenuOpen = !this.isUserMenuOpen;
  }

  handleNavClick(event: MouseEvent, link: string): void {
    if (event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    this.isUserMenuOpen = false;

    if (this.router.url.split('?')[0] === link) {
      return;
    }

    void this.router.navigateByUrl(link);
  }

  closeUserMenu(event?: MouseEvent): void {
    event?.stopPropagation();
    this.isUserMenuOpen = false;
  }

  navigateToProfile(event?: MouseEvent): void {
    event?.stopPropagation();
    this.isUserMenuOpen = false;
    this.isCollabSettingsOpen = false;

    switch (this.userRole) {
      case 'ADMIN':
        void this.router.navigate(['/admin/profil']);
        return;
      case 'MANAGER':
        void this.router.navigate(['/manager/profil']);
        return;
      case 'COLLAB':
        void this.router.navigate(['/mon-profil']);
        return;
      default:
        void this.router.navigate(['/dashboard']);
    }
  }

  toggleCollabMode(): void {
    this.collabPreferences.theme = this.collabPreferences.theme === 'dark' ? 'light' : 'dark';
    this.applyCollabPreferences();
    this.persistCollabPreferences();
  }

  toggleCollabNotifications(event: MouseEvent): void {
    event.stopPropagation();
    this.isCollabNotifOpen = !this.isCollabNotifOpen;
  }

  openCollabSettings(event: MouseEvent): void {
    event.stopPropagation();
    this.isCollabNotifOpen = false;
    this.isCollabExportOpen = false;
    this.isCollabSettingsOpen = true;
  }

  closeCollabSettings(event?: MouseEvent): void {
    event?.stopPropagation();
    this.isCollabSettingsOpen = false;
  }

  openCollabExport(event: MouseEvent): void {
    event.stopPropagation();
    this.isCollabNotifOpen = false;
    this.isCollabSettingsOpen = false;
    this.isCollabExportOpen = true;
  }

  closeCollabExport(event?: MouseEvent): void {
    event?.stopPropagation();
    this.isCollabExportOpen = false;
  }

  selectExportFormat(format: ExportFormat, event?: MouseEvent): void {
    event?.stopPropagation();
    this.selectedExportFormat = format;
  }

  updateCollabPreferences(): void {
    this.applyCollabPreferences();
    this.persistCollabPreferences();

    if (this.isCollaborateurRole) {
      this.authService.updateNavbarPreferences(this.toNavbarPreferencesPayload()).subscribe({
        next: (preferences) => this.applyRemoteCollabPreferences(preferences),
        error: () => undefined
      });
    }
  }

  updateCollabExportOptions(): void {
    this.persistCollabExportOptions();
  }

  submitCollabSearch(event?: Event): void {
    event?.preventDefault();
    event?.stopPropagation();

    const focus = this.collabSearchTerm.trim();
    const targetRoute = this.resolveCollabSearchRoute();

    void this.router.navigate([targetRoute], {
      queryParams: { focus: focus || null }
    });
  }

  downloadCollabExport(event?: MouseEvent): void {
    event?.stopPropagation();

    const extension = this.selectedExportFormat === 'pdf' ? 'pdf' : 'csv';
    const mimeType = this.selectedExportFormat === 'pdf' ? 'application/pdf' : 'text/csv;charset=utf-8';
    const timestamp = new Date().toISOString().slice(0, 19).replace(/[T:]/g, '-');
    const includedSections = [
      this.collabExportOptions.projects ? 'Projets' : null,
      this.collabExportOptions.planning ? 'Planning' : null,
      this.collabExportOptions.metrics ? 'Metriques' : null
    ].filter((value): value is string => Boolean(value));
    const pdfText = [
      'SmartAssign Export',
      `Format: ${this.selectedExportFormat.toUpperCase()}`,
      `Genere le: ${new Date().toLocaleString()}`,
      `Utilisateur: ${this.displayUserName}`,
      `Sections: ${includedSections.join(', ') || 'Aucune'}`
    ]
      .map((line) => line.replace(/[()\\]/g, ''))
      .join(' ');
    const pdfStream = `BT /F1 18 Tf 50 760 Td (${pdfText}) Tj ET`;
    const pdfLength = pdfStream.length;
    const pdfPayload = `%PDF-1.4\n1 0 obj<< /Type /Catalog /Pages 2 0 R >>endobj\n2 0 obj<< /Type /Pages /Count 1 /Kids [3 0 R] >>endobj\n3 0 obj<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>endobj\n4 0 obj<< /Length ${pdfLength} >>stream\n${pdfStream}\nendstream\nendobj\n5 0 obj<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>endobj\nxref\n0 6\n0000000000 65535 f \n0000000010 00000 n \n0000000063 00000 n \n0000000122 00000 n \n0000000248 00000 n \n0000000343 00000 n \ntrailer<< /Size 6 /Root 1 0 R >>\nstartxref\n413\n%%EOF`;
    const csvPayload = [
      'section,valeur',
      `utilisateur,${this.displayUserName}`,
      `role,${this.roleBadgeLabel}`,
      `genere_le,${new Date().toLocaleString()}`,
      `format,${this.selectedExportFormat.toUpperCase()}`,
      `inclure,${includedSections.join(' | ') || 'Aucune'}`
    ].join('\n');
    const payload = this.selectedExportFormat === 'pdf' ? pdfPayload : csvPayload;

    const blob = new Blob([payload], { type: mimeType });
    const url = window.URL.createObjectURL(blob);
    const anchor = document.createElement('a');

    anchor.href = url;
    anchor.download = `smartassign-export-${timestamp}.${extension}`;
    anchor.click();

    window.URL.revokeObjectURL(url);
    this.isCollabExportOpen = false;
  }

  private async initializeCollabNotifications(): Promise<void> {
    if (!this.isCollaborateurRole || this.collabNotificationSource) {
      return;
    }

    const module = await import('./services/manager/notification.service');
    const notificationSource = new module.NotificationService();

    this.collabNotificationSource = notificationSource;
    this.collabNotificationFeed = notificationSource.getSnapshot();
    this.notificationSub = notificationSource.notifications$.subscribe((notification: CollabNotificationPayload) => {
      this.collabNotificationFeed = [notification, ...this.collabNotificationFeed].slice(0, 100);
    });
  }

  private shouldDisplayCollabNotification(notification: CollabNotificationPayload): boolean {
    if (!this.collabPreferences.notificationsEnabled) {
      return false;
    }

    const level = (notification.niveau ?? '').toUpperCase();
    const type = (notification.type ?? '').toUpperCase();

    if (!this.collabPreferences.urgentAlerts && (level === 'WARNING' || level === 'DANGER')) {
      return false;
    }

    if (!this.collabPreferences.projectUpdates && (type.includes('PROJET') || type.includes('AFFECTATION') || type.includes('PLANNING'))) {
      return false;
    }

    return true;
  }

  private mapCollabNotificationTone(notification: CollabNotificationPayload): 'orange' | 'green' | 'blue' {
    const level = (notification.niveau ?? '').toUpperCase();
    const title = `${notification.titre} ${notification.message}`.toLowerCase();

    if (title.includes('complete') || title.includes('termine') || title.includes('succes')) {
      return 'green';
    }

    if (level === 'WARNING' || level === 'DANGER') {
      return 'orange';
    }

    return 'blue';
  }

  private formatRelativeTime(value: string): string {
    const parsed = new Date(value);

    if (Number.isNaN(parsed.getTime())) {
      return 'A l\'instant';
    }

    const diffMinutes = Math.max(0, Math.round((Date.now() - parsed.getTime()) / 60000));

    if (diffMinutes < 1) {
      return 'A l\'instant';
    }

    if (diffMinutes < 60) {
      return `Il y a ${diffMinutes} min`;
    }

    const diffHours = Math.round(diffMinutes / 60);
    if (diffHours < 24) {
      return `Il y a ${diffHours} h`;
    }

    const diffDays = Math.round(diffHours / 24);
    return diffDays === 1 ? 'Hier' : `Il y a ${diffDays} j`;
  }

  private resolveCollabSearchRoute(): string {
    const currentRoute = this.router.url.split('?')[0];

    if (currentRoute === '/planning') {
      return '/planning';
    }

    return '/mes-projets';
  }

  private syncCollabSearchFromRoute(): void {
    const focus = this.router.parseUrl(this.router.url).queryParams['focus'];
    this.collabSearchTerm = typeof focus === 'string' ? focus : '';
  }

  private loadCollabPreferences(): void {
    const stored = localStorage.getItem(this.collabPreferencesStorageKey);

    if (stored) {
      try {
        this.collabPreferences = {
          ...this.collabPreferences,
          ...JSON.parse(stored)
        } as CollabNavbarPreferences;
      } catch {
        localStorage.removeItem(this.collabPreferencesStorageKey);
      }
    }

    this.applyCollabPreferences();
  }

  private loadCollabPreferencesFromServer(): void {
    this.hasLoadedRemoteCollabPreferences = true;
    this.authService.getNavbarPreferences().subscribe({
      next: (preferences) => this.applyRemoteCollabPreferences(preferences),
      error: () => {
        this.hasLoadedRemoteCollabPreferences = false;
      }
    });
  }

  private persistCollabPreferences(): void {
    localStorage.setItem(this.collabPreferencesStorageKey, JSON.stringify(this.collabPreferences));
  }

  private applyRemoteCollabPreferences(preferences: NavbarPreferencesPayload): void {
    this.collabPreferences = {
      ...this.collabPreferences,
      ...preferences
    };
    this.applyCollabPreferences();
    this.persistCollabPreferences();
  }

  private toNavbarPreferencesPayload(): NavbarPreferencesPayload {
    return {
      notificationsEnabled: this.collabPreferences.notificationsEnabled,
      urgentAlerts: this.collabPreferences.urgentAlerts,
      projectUpdates: this.collabPreferences.projectUpdates,
      language: this.collabPreferences.language,
      displayDensity: this.collabPreferences.displayDensity,
      theme: this.collabPreferences.theme
    };
  }

  private applyCollabPreferences(): void {
    this.isCollabModeOff = this.collabPreferences.theme === 'light';
    document.documentElement.lang = this.collabPreferences.language;
  }

  private loadCollabExportOptions(): void {
    const stored = localStorage.getItem(this.collabExportStorageKey);

    if (stored) {
      try {
        this.collabExportOptions = {
          ...this.collabExportOptions,
          ...JSON.parse(stored)
        } as CollabExportOptions;
      } catch {
        localStorage.removeItem(this.collabExportStorageKey);
      }
    }
  }

  private persistCollabExportOptions(): void {
    localStorage.setItem(this.collabExportStorageKey, JSON.stringify(this.collabExportOptions));
  }

  private buildSidebarSections(role: string): NavSection[] {
    switch (role) {
      case 'ADMIN':
        return [
          {
            title: 'Principal',
            items: [
              { label: 'Supervision', icon: 'supervision', link: '/admin/dashboard', exact: true },
              { label: 'Utilisateurs', icon: 'utilisateurs', link: '/admin/collaborateurs' },
              { label: 'Projets', icon: 'projets', link: '/admin/projets' },
              { label: 'Affectations', icon: 'affectations', link: '/admin/affectation' }
            ]
          }
        ];
      case 'MANAGER':
        return [
          {
            title: 'Principal',
            items: [
              { label: 'Pilotage', icon: 'supervision', link: '/manager/dashboard', exact: true },
              { label: 'Collaborateurs', icon: 'utilisateurs', link: '/manager/collaborateurs' },
              { label: 'Projets', icon: 'projets', link: '/manager/projets' },
              { label: 'Affectations', icon: 'affectations', link: '/manager/affectation' },
              { label: 'Charge', icon: 'charge', link: '/manager/charge-travail' }
            ]
          },
          {
            title: 'Autre',
            items: [
              { label: 'Historique', icon: 'historique', link: '/manager/historique-affectations' }
            ]
          }
        ];
      case 'COLLAB':
        return [
          {
            title: 'Principal',
            items: [
              { label: 'Dashboard', icon: 'supervision', link: '/collaborateurs/collaborateurs/dashboard', exact: true },
              { label: 'Mes projets', icon: 'projets', link: '/mes-projets' },
              { label: 'Planning', icon: 'charge', link: '/planning' },
              { label: 'Historique', icon: 'historique', link: '/historique' }
            ]
          }
        ];
      default:
        return [
          {
            title: 'Principal',
            items: [{ label: 'Dashboard', icon: 'supervision', link: '/collaborateurs/collaborateurs/dashboard', exact: true }]
          }
        ];
    }
  }

  private preloadRoleRoutes(role: string): void {
    const normalizedRole = role?.toUpperCase?.() ?? '';

    if (!normalizedRole || this.preloadedRoles.has(normalizedRole)) {
      return;
    }

    this.preloadedRoles.add(normalizedRole);

    if (normalizedRole === 'MANAGER') {
      void Promise.all([
        import('./features/manager/dashboard/dashboard.component'),
        import('./features/manager/profil/profil.component'),
        import('./features/manager/projets/liste/liste.component'),
        import('./features/manager/charge-travail/charge-travail.component'),
        import('./features/manager/affectation/resultats/resultats.component'),
        import('./features/manager/historique-affectations/historique-affectations.component')
      ]);
      return;
    }

    if (normalizedRole === 'ADMIN') {
      void Promise.all([
        import('./features/admin/dashboard/dashboard.component'),
        import('./features/admin/profil/profil.component'),
        import('./features/admin/collaborateurs/liste/liste.component'),
        import('./features/admin/projets/liste/liste.component')
      ]);
    }

    if (normalizedRole === 'COLLAB') {
      void Promise.all([
        import('./features/collaborateurs/profil/profil.component'),
        import('./features/collaborateurs/dashboard/dashboard.component'),
        import('./features/collaborateurs/mes-projets/mes-projets.component'),
        import('./features/collaborateurs/planning/planning.component'),
        import('./features/collaborateurs/historique/historique.component')
      ]);
    }
  }
}