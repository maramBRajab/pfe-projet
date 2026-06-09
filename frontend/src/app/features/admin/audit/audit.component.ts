import { CommonModule, DatePipe } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { AdminSidebarComponent } from '../shared/admin-sidebar.component';
import { AdminTopbarComponent } from '../shared/admin-topbar.component';
import { AdminAuditService } from '../../../services/admin/audit.service';
import { AuthService } from '../../../services/auth';

export interface AuditLog {
  id: number;
  action: string;
  actorEmail?: string;
  actorRole?: string;
  ipAddress?: string;
  user?: string;
  userRole?: string;
  ip?: string;
  status?: string;
  description?: string;
  details?: string;
  target?: string;
  date?: string;
  severity: 'Info' | 'Critique' | 'Vigilance' | 'INFO' | 'WARNING' | 'CRITICAL' | string;
  createdAt: string;
}

interface LogGroup {
  dateLabel: string;
  logs: AuditLogView[];
}

type AuditSeverity = 'Info' | 'Vigilance' | 'Critique';
type AuditCategory = 'Sécurité' | 'Utilisateurs' | 'Projets' | 'Système';

interface AuditLogView {
  id: number;
  actionCode: string;
  rawAction: string;
  eventLabel: string;
  category: AuditCategory;
  summary: string;
  detailedDescription: string;
  rawDescription: string;
  actorEmail: string;
  actorRole: string;
  actorRoleDisplay: string;
  userDisplay: string;
  userEmailDisplay: string;
  projectName: string;
  ipAddress: string;
  rawStatus: string;
  rawTarget: string;
  rawDetails: string;
  severity: AuditSeverity;
  createdAtIso: string;
  createdAtDate: Date;
  icon: string;
  modifiedData: Array<{ key: string; value: string }>;
}

interface ActionMeta {
  label: string;
  category: AuditCategory;
  icon: string;
  defaultSeverity?: AuditSeverity;
}

@Component({
  selector: 'app-admin-audit',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, AdminSidebarComponent, AdminTopbarComponent, DatePipe, MatIconModule],
  templateUrl: './audit.component.html',
  styleUrls: ['./audit.component.scss'],
})
export class AdminAuditComponent implements OnInit {
  today = new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  adminPhoto: string | null = null;
  loading = false;
  error = '';

  logs: AuditLogView[] = [];
  filteredLogs: AuditLogView[] = [];
  groupedLogs: LogGroup[] = [];

  searchQuery = '';
  selectedDateFrom = '';
  selectedActor = '';
  selectedType = '';
  selectedSeverity: '' | AuditSeverity = '';
  selectedProject = '';
  selectedCategory: '' | AuditCategory = '';

  showModal = false;
  selectedLog: AuditLogView | null = null;

  actorOptions: string[] = [];
  projectOptions: string[] = [];

  private readonly statusToSeverity: Record<string, AuditSeverity> = {
    SUCCESS: 'Info',
    FAILED: 'Critique',
    WARNING: 'Vigilance',
    INFO: 'Info',
    CRITICAL: 'Critique',
  };

  readonly actionMeta: Record<string, ActionMeta> = {
    LOGIN: { label: 'Connexion', category: 'Sécurité', icon: 'login' },
    LOGOUT: { label: 'Déconnexion', category: 'Sécurité', icon: 'logout' },
    LOGIN_FAILED: { label: 'Échec de connexion', category: 'Sécurité', icon: 'gpp_bad', defaultSeverity: 'Critique' },
    CHANGE_PASSWORD: { label: 'Changement de mot de passe', category: 'Sécurité', icon: 'password' },
    RESET_PASSWORD: { label: 'Réinitialisation du mot de passe', category: 'Sécurité', icon: 'lock_reset', defaultSeverity: 'Vigilance' },
    VERIFY_EMAIL: { label: 'Vérification email', category: 'Sécurité', icon: 'verified_user' },
    RESEND_VERIFICATION: { label: 'Renvoi de l\'email de vérification', category: 'Sécurité', icon: 'mark_email_unread' },

    CREATE_USER: { label: 'Création utilisateur', category: 'Utilisateurs', icon: 'person_add' },
    UPDATE_USER: { label: 'Modification d\'utilisateur', category: 'Utilisateurs', icon: 'manage_accounts' },
    USER_UPDATE: { label: 'Modification d\'utilisateur', category: 'Utilisateurs', icon: 'manage_accounts' },
    DELETE_USER: { label: 'Suppression d\'utilisateur', category: 'Utilisateurs', icon: 'person_remove', defaultSeverity: 'Critique' },
    ACTIVATION: { label: 'Activation de compte', category: 'Utilisateurs', icon: 'person_check' },
    SUSPENSION: { label: 'Suspension de compte', category: 'Utilisateurs', icon: 'person_off', defaultSeverity: 'Vigilance' },
    STATUS_CHANGE: { label: 'Changement de statut', category: 'Utilisateurs', icon: 'sync_alt', defaultSeverity: 'Vigilance' },

    CREATE_PROJET: { label: 'Création projet', category: 'Projets', icon: 'post_add' },
    UPDATE_PROJET: { label: 'Modification projet', category: 'Projets', icon: 'edit_note' },
    DELETE_PROJET: { label: 'Suppression projet', category: 'Projets', icon: 'delete_forever', defaultSeverity: 'Critique' },
    ASSIGN: { label: 'Affectation collaborateur', category: 'Projets', icon: 'assignment_ind', defaultSeverity: 'Vigilance' },
    UNASSIGN: { label: 'Retrait d\'affectation', category: 'Projets', icon: 'assignment_late', defaultSeverity: 'Vigilance' },

    PARAMETRES: { label: 'Modification des paramètres', category: 'Système', icon: 'tune', defaultSeverity: 'Vigilance' },
    ROLE_CHANGE: { label: 'Gestion des rôles', category: 'Système', icon: 'admin_panel_settings', defaultSeverity: 'Vigilance' },
    PERMISSION_CHANGE: { label: 'Gestion des permissions', category: 'Système', icon: 'rule', defaultSeverity: 'Vigilance' },
    EXPORT: { label: 'Export', category: 'Système', icon: 'download' },
    GENERATE_TEST_DATA: { label: 'Génération de données de test', category: 'Système', icon: 'science' },
  };

  readonly AUDIT_ACTIONS = new Set([
    'LOGIN',
    'LOGOUT',
    'LOGIN_FAILED',
    'CHANGE_PASSWORD',
    'RESET_PASSWORD',
    'RESEND_VERIFICATION',
    'VERIFY_EMAIL',
    'DELETE_USER',
    'ACTIVATION',
    'SUSPENSION',
    'ROLE_CHANGE',
    'PERMISSION_CHANGE',
    'CREATE_PROJET',
    'UPDATE_PROJET',
    'DELETE_PROJET',
    'ASSIGN',
    'UNASSIGN',
    'PARAMETRES',
    'EXPORT',
    'GENERATE_TEST_DATA',
  ]);

  readonly TYPE_OPTIONS = Object.keys(this.actionMeta).filter((action) => this.AUDIT_ACTIONS.has(action));
  readonly categoryOrder: AuditCategory[] = ['Sécurité', 'Utilisateurs', 'Projets', 'Système'];

  constructor(
    private auditService: AdminAuditService,
    private readonly authService: AuthService
  ) {}

  get totalCount():     number { return this.filteredLogs.length; }
  get critiqueCount():  number { return this.filteredLogs.filter((l) => l.severity === 'Critique').length; }
  get vigilanceCount(): number { return this.filteredLogs.filter((l) => l.severity === 'Vigilance').length; }
  get infoCount():      number { return this.filteredLogs.filter((l) => l.severity === 'Info').length; }

  ngOnInit(): void {
    this.adminPhoto = this.authService.currentUser?.photoUrl ?? null;
    this.loading = true;
    this.auditService.getAuditLogs().subscribe({
      next: (data: AuditLog[]) => {
        this.logs = data
          .map((l) => this.toViewModel(l))
          .filter((log) => this.isAuditAction(log.actionCode));
        this.actorOptions = this.buildOptions(this.logs.map((l) => l.userDisplay));
        this.projectOptions = this.buildOptions(this.logs.map((l) => l.projectName).filter((p) => p !== 'Non concerné'));
        this.applyFilters();
        this.loading = false;
      },
      error: (err) => {
        this.error = 'Impossible de charger les logs.';
        this.loading = false;
        console.error(err);
      },
    });
  }

  applyFilters(): void {
    let result = [...this.logs];

    if (this.searchQuery) {
      const q = this.searchQuery.toLowerCase();
      result = result.filter(
        (l) =>
          l.summary.toLowerCase().includes(q) ||
          l.detailedDescription.toLowerCase().includes(q) ||
          l.actorEmail.toLowerCase().includes(q) ||
          l.userDisplay.toLowerCase().includes(q) ||
          l.projectName.toLowerCase().includes(q)
      );
    }

    if (this.selectedDateFrom) {
      const from = new Date(`${this.selectedDateFrom}T00:00:00`);
      const to = new Date(`${this.selectedDateFrom}T23:59:59`);
      result = result.filter((l) => l.createdAtDate >= from && l.createdAtDate <= to);
    }

    if (this.selectedActor) {
      result = result.filter((l) => l.userDisplay === this.selectedActor);
    }

    if (this.selectedType) {
      result = result.filter((l) => l.actionCode === this.selectedType);
    }

    if (this.selectedSeverity) {
      result = result.filter((l) => l.severity === this.selectedSeverity);
    }

    if (this.selectedProject) {
      result = result.filter((l) => l.projectName === this.selectedProject);
    }

    if (this.selectedCategory) {
      result = result.filter((l) => l.category === this.selectedCategory);
    }

    this.filteredLogs = result;
    this.buildGroups();
  }

  buildGroups(): void {
    const map: { [key: string]: AuditLogView[] } = {};
    this.filteredLogs.forEach((log) => {
      const d = log.createdAtIso.substring(0, 10);
      if (!map[d]) map[d] = [];
      map[d].push(log);
    });

    const today = new Date().toISOString().substring(0, 10);
    const yesterday = new Date(Date.now() - 86400000).toISOString().substring(0, 10);
    this.groupedLogs = Object.entries(map)
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([date, logs]) => ({
        dateLabel: date === today ? "AUJOURD'HUI" : date === yesterday ? 'HIER' : date,
        logs,
      }));
  }

  openDetail(log: AuditLogView): void {
    this.selectedLog = log;
    this.showModal = true;
  }

  closeModal(): void {
    this.showModal = false;
    this.selectedLog = null;
  }

  resetFilters(): void {
    this.searchQuery = '';
    this.selectedDateFrom = '';
    this.selectedActor = '';
    this.selectedType = '';
    this.selectedSeverity = '';
    this.selectedProject = '';
    this.selectedCategory = '';
    this.applyFilters();
  }

  exportCSV(): void {
    const headers = ['Catégorie', 'Type', 'Description', 'Utilisateur', 'Email', 'Rôle', 'Projet', 'IP', 'Sévérité', 'Date'];
    const rows = this.filteredLogs.map((l) => [
      l.category,
      l.eventLabel,
      l.summary,
      l.userDisplay,
      l.userEmailDisplay,
      l.actorRoleDisplay,
      l.projectName,
      l.ipAddress,
      l.severity,
      l.createdAtIso,
    ]);
    const csv = [headers, ...rows]
      .map((r) => r.map((c) => '"' + String(c).replace(/"/g, '""') + '"').join(','))
      .join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'audit-export.csv';
    a.click();
    URL.revokeObjectURL(url);
  }

  exportPDF(): void {
    window.print();
  }

  getCategoryIcon(category: AuditCategory): string {
    return {
      'Sécurité': 'shield',
      'Utilisateurs': 'groups',
      'Projets': 'folder_open',
      'Système': 'settings',
    }[category];
  }

  getCategoryClass(category: AuditCategory): string {
    return {
      'Sécurité': 'cat-security',
      'Utilisateurs': 'cat-users',
      'Projets': 'cat-projects',
      'Système': 'cat-system',
    }[category];
  }

  getActionDotColor(actionCode: string): string {
    const colorMap: Record<string, string> = {
      LOGIN: '#0f6cbd',
      LOGOUT: '#1e8e3e',
      LOGIN_FAILED: '#d13438',
      RESEND_VERIFICATION: '#8a5a00',
      CREATE_USER: '#1e8e3e',
      UPDATE_USER: '#8a5a00',
      USER_UPDATE: '#8a5a00',
      DELETE_USER: '#d13438',
      ACTIVATION: '#1e8e3e',
      SUSPENSION: '#8a5a00',
      STATUS_CHANGE: '#8a5a00',
      CREATE_PROJET: '#1e8e3e',
      UPDATE_PROJET: '#8a5a00',
      DELETE_PROJET: '#d13438',
      ASSIGN: '#0f6cbd',
      UNASSIGN: '#8a5a00',
      PARAMETRES: '#6b46c1',
      ROLE_CHANGE: '#6b46c1',
      PERMISSION_CHANGE: '#6b46c1',
      EXPORT: '#475569',
      GENERATE_TEST_DATA: '#0f6cbd',
    };

    return colorMap[actionCode] || '#64748b';
  }

  getCategoryTitle(category: AuditCategory): string {
    return {
      'Sécurité': 'Sécurité',
      'Utilisateurs': 'Utilisateurs',
      'Projets': 'Projets',
      'Système': 'Système',
    }[category];
  }

  getGroupCategoryLogs(group: LogGroup, category: AuditCategory): AuditLogView[] {
    return group.logs.filter((l) => l.category === category);
  }

  traduireTypeEvenement(type: string): string {
    const action = this.normalizeAction(type);
    return this.actionMeta[action]?.label ?? this.toSentenceCase(type ?? 'Événement inconnu');
  }

  traduireSeverite(severity: string): AuditSeverity {
    const normalized = (severity ?? '').trim().toUpperCase();

    if (normalized === 'CRITICAL' || normalized === 'CRITIQUE') {
      return 'Critique';
    }

    if (normalized === 'WARNING' || normalized === 'VIGILANCE') {
      return 'Vigilance';
    }

    return 'Info';
  }

  private toViewModel(raw: AuditLog): AuditLogView {
    const actionCode = this.normalizeAction(raw.action);
    const actionMeta = this.actionMeta[actionCode] ?? {
      label: this.toSentenceCase(raw.action || 'Événement'),
      category: 'Système' as AuditCategory,
      icon: 'event_note',
    };

    const createdAtIso = raw.date || raw.createdAt || new Date().toISOString();
    const createdAtDate = new Date(createdAtIso);

    const actorEmail = this.firstNonBlank(raw.user, raw.actorEmail, 'Compte non identifié');
    const actorRole = this.firstNonBlank(raw.userRole, raw.actorRole, 'INCONNU');
    const actorRoleDisplay = this.toRoleDisplay(actorRole);

    const severity = this.resolveSeverity(raw, actionMeta.defaultSeverity);
    const target = this.resolveTarget(raw);
    const projectName = this.resolveProjectName(raw, actionCode, target);
    const userDisplay = this.resolveUserDisplay(raw, actionCode, target, actorEmail);
    const userEmailDisplay = this.resolveUserEmail(raw, actionCode, target, actorEmail);

    return {
      id: Number(raw.id ?? 0),
      actionCode,
      rawAction: this.firstNonBlank(raw.action, actionCode),
      eventLabel: actionMeta.label,
      category: actionMeta.category,
      summary: this.buildSummary(raw, actionCode, actionMeta.label, target, userDisplay, projectName),
      detailedDescription: this.buildDetailedDescription(raw, actionMeta.label, target, projectName),
      rawDescription: this.firstNonBlank(raw.description, 'N/A'),
      actorEmail,
      actorRole,
      actorRoleDisplay,
      userDisplay,
      userEmailDisplay,
      projectName,
      ipAddress: this.formatIpAddress(this.firstNonBlank(raw.ip, raw.ipAddress, 'N/A')),
      rawStatus: this.firstNonBlank(raw.status, 'N/A'),
      rawTarget: this.firstNonBlank(raw.target, 'N/A'),
      rawDetails: this.firstNonBlank(raw.details, 'N/A'),
      severity,
      createdAtIso,
      createdAtDate,
      icon: actionMeta.icon,
      modifiedData: this.extractModifiedData(raw),
    };
  }

  private resolveSeverity(raw: AuditLog, fallback?: AuditSeverity): AuditSeverity {
    const fromStatus = this.statusToSeverity[(raw.status || '').toUpperCase()];
    if (fromStatus) return fromStatus;

    const translated = this.traduireSeverite(raw.severity || '');
    if (translated !== 'Info' || !fallback) return translated;

    return fallback;
  }

  private normalizeAction(action?: string): string {
    return (action ?? '')
      .trim()
      .replace(/[\s-]+/g, '_')
      .toUpperCase();
  }

  private isAuditAction(actionCode: string): boolean {
    if (this.AUDIT_ACTIONS.has(actionCode)) {
      return true;
    }

    return actionCode.startsWith('AI_') || actionCode.startsWith('IA_') || actionCode.startsWith('SYSTEM_');
  }

  private toRoleDisplay(role: string): string {
    const normalized = (role || '').trim().toUpperCase();

    if (!normalized || normalized === 'INCONNU') {
      return 'Utilisateur non authentifié';
    }

    return {
      ADMIN: 'Administrateur',
      MANAGER: 'Manager',
      COLLAB: 'Collaborateur',
      USER: 'Utilisateur',
    }[normalized] ?? this.toSentenceCase(normalized.toLowerCase());
  }

  private buildSummary(raw: AuditLog, actionCode: string, label: string, target: string, userDisplay: string, projectName: string): string {
    const effectiveTarget = target || userDisplay;

    switch (actionCode) {
      case 'DELETE_USER':
        return `Suppression de l'utilisateur : ${effectiveTarget}`;
      case 'UPDATE_USER':
      case 'USER_UPDATE':
        return `Modification de l'utilisateur : ${effectiveTarget}`;
      case 'CREATE_USER':
        return `Création de l'utilisateur : ${effectiveTarget}`;
      case 'RESEND_VERIFICATION':
        return `Renvoi de l'email de vérification pour : ${effectiveTarget}`;
      case 'LOGIN_FAILED':
        return `Échec de connexion pour : ${effectiveTarget}`;
      case 'ACTIVATION':
        return `Activation du compte utilisateur : ${effectiveTarget}`;
      case 'SUSPENSION':
        return `Suspension du compte utilisateur : ${effectiveTarget}`;
      case 'STATUS_CHANGE':
        return `Changement de statut utilisateur : ${effectiveTarget}`;
      case 'ASSIGN':
        return `Affectation collaborateur sur le projet : ${projectName}`;
      case 'UNASSIGN':
        return `Retrait d'affectation sur le projet : ${projectName}`;
      case 'CREATE_PROJET':
      case 'UPDATE_PROJET':
      case 'DELETE_PROJET':
        return `${label} : ${projectName}`;
      case 'GENERATE_TEST_DATA':
        return 'Génération des données de test dashboard RH';
      default:
        return target ? `${label} : ${target}` : label;
    }
  }

  private buildDetailedDescription(raw: AuditLog, label: string, target: string, projectName: string): string {
    const fromAudit = this.firstNonBlank(raw.description, raw.details);
    if (fromAudit) {
      return fromAudit;
    }

    if (projectName !== 'Non concerné') {
      return `${label} sur le projet ${projectName}.`;
    }

    if (target) {
      return `${label} concernant ${target}.`;
    }

    return `${label} enregistré dans le journal d'audit.`;
  }

  private resolveTarget(raw: AuditLog): string {
    const fromRaw = this.firstNonBlank(raw.target);
    if (fromRaw) return fromRaw;

    const details = this.parseDetails(raw.details);
    const fromDetails = this.firstNonBlank(
      details?.['target'],
      details?.['user'],
      details?.['fullName'],
      details?.['displayName'],
      details?.['project'],
      details?.['projectName']
    );

    return fromDetails;
  }

  private resolveProjectName(raw: AuditLog, actionCode: string, target: string): string {
    const details = this.parseDetails(raw.details);
    const fromDetails = this.firstNonBlank(details?.['projectName'], details?.['project'], details?.['projet']);
    if (fromDetails) return fromDetails;

    const source = `${raw.description || ''} ${raw.target || ''}`;
    const regex = /projet\s*[:\-]?\s*([^,.;]+)/i;
    const match = source.match(regex);
    if (match?.[1]) return match[1].trim();

    if (actionCode.includes('PROJET') || actionCode === 'ASSIGN' || actionCode === 'UNASSIGN') {
      return target || 'Projet non spécifié';
    }

    return 'Non concerné';
  }

  private resolveUserDisplay(raw: AuditLog, actionCode: string, target: string, actorEmail: string): string {
    const details = this.parseDetails(raw.details);
    const detailsName = this.firstNonBlank(details?.['fullName'], details?.['displayName'], details?.['userName']);

    if (detailsName) return detailsName;
    if (actionCode.includes('USER') && target) return target;
    if (target && this.looksLikePersonLabel(target)) return target;
    if (actorEmail === 'Compte non identifié') return 'Compte non identifié';

    return actorEmail;
  }

  private resolveUserEmail(raw: AuditLog, actionCode: string, target: string, actorEmail: string): string {
    const details = this.parseDetails(raw.details);
    const explicitEmail = this.firstNonBlank(details?.['email'], details?.['userEmail']);
    if (explicitEmail) return explicitEmail;

    if (this.isEmail(target) && actionCode.includes('USER')) return target;

    return actorEmail;
  }

  private extractModifiedData(raw: AuditLog): Array<{ key: string; value: string }> {
    const parsed = this.parseDetails(raw.details);
    if (parsed) {
      return Object.entries(parsed)
        .filter(([key, value]) => !['target', 'project', 'projectName', 'email', 'user', 'userEmail'].includes(key) && value !== null && value !== undefined && `${value}`.trim() !== '')
        .map(([key, value]) => ({ key: this.toSentenceCase(key.replace(/_/g, ' ')), value: String(value) }));
    }

    const rawDetails = (raw.details ?? '').trim();
    if (!rawDetails) return [];

    return [{ key: 'Données', value: rawDetails }];
  }

  private parseDetails(details?: string): Record<string, any> | null {
    if (!details) return null;

    const trimmed = details.trim();
    if (!trimmed.startsWith('{') || !trimmed.endsWith('}')) {
      return null;
    }

    try {
      const parsed = JSON.parse(trimmed);
      return typeof parsed === 'object' && parsed !== null ? parsed : null;
    } catch {
      return null;
    }
  }

  private formatIpAddress(ip: string): string {
    const normalized = (ip || '').trim();
    const localhostValues = ['::1', '0:0:0:0:0:0:0:1', '127.0.0.1', '::ffff:127.0.0.1'];
    if (localhostValues.includes(normalized.toLowerCase())) {
      return 'Localhost';
    }

    if (normalized.toLowerCase().startsWith('::ffff:')) {
      return normalized.substring(7);
    }

    return normalized || 'N/A';
  }

  private buildOptions(values: string[]): string[] {
    return [...new Set(values.filter((v) => (v || '').trim() !== ''))].sort((a, b) => a.localeCompare(b, 'fr'));
  }

  private looksLikePersonLabel(value: string): boolean {
    return !!value && !value.toLowerCase().includes('projet');
  }

  private isEmail(value: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value || '');
  }

  private firstNonBlank(...values: Array<string | undefined | null>): string {
    for (const value of values) {
      if (value && value.trim().length > 0) {
        return value.trim();
      }
    }
    return '';
  }

  private toSentenceCase(value: string): string {
    const normalized = (value || '').trim();
    if (!normalized) return '';
    return normalized.charAt(0).toUpperCase() + normalized.slice(1);
  }
}








