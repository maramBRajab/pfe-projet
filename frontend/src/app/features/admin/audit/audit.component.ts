import { CommonModule, DatePipe } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { AdminSidebarComponent } from '../shared/admin-sidebar.component';
import { AdminAuditService } from '../../../services/admin/audit.service';

export type AuditAction =
  | 'LOGIN' | 'LOGOUT' | 'LOGIN_FAILED'
  | 'CREATE_USER' | 'UPDATE_USER' | 'DELETE_USER'
  | 'CREATE_PROJET' | 'UPDATE_PROJET' | 'DELETE_PROJET'
  | 'ASSIGN' | 'UNASSIGN'
  | 'ROLE_CHANGE'
  | 'EXPORT'
  | 'PARAMETRES';

export type AuditStatus = 'SUCCESS' | 'FAILED' | 'WARNING';

export interface AuditLog {
  id: number;
  date: Date;
  user: string;
  userRole: string;
  action: AuditAction;
  description: string;
  ip: string;
  status: AuditStatus;
  details: string;
  target?: string;
}


@Component({
  selector: 'app-admin-audit',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, AdminSidebarComponent, DatePipe],
  templateUrl: './audit.component.html',
  styleUrls: ['./audit.component.scss']
})
export class AdminAuditComponent implements OnInit {
  currentDate = new Date();
  allLogs: AuditLog[] = [];
  loading = false;
  error = '';
  adminPhoto: string | null = null;

  constructor(private auditService: AdminAuditService) {}

  // ── Filters ──────────────────────────────────────────────
  filterSearch  = '';
  filterUser    = '';
  filterAction  = '';
  filterStatus  = '';
  filterDateFrom = '';
  filterDateTo   = '';

  // ── Pagination ───────────────────────────────────────────
  pageSize     = 25;
  currentPage  = 1;

  // ── Timeline ─────────────────────────────────────────────
  timelineLimit = 5;

  get hasMoreTimeline(): boolean {
    return (this.todayLogs.length + this.yesterdayLogs.length + this.recentLogs.length) > this.timelineLimit;
  }

  loadMoreTimeline(): void {
    this.timelineLimit += 5;
  }

  // ── Sort ─────────────────────────────────────────────────
  sortCol: keyof AuditLog = 'date';
  sortDir: 'asc' | 'desc' = 'desc';

  // ── Modal ─────────────────────────────────────────────────
  selectedLog: AuditLog | null = null;

  // ── Unique users for filter dropdown ─────────────────────
  get uniqueUsers(): string[] {
    return [...new Set(this.allLogs.map(l => l.user))].sort();
  }

  readonly actionLabels: Record<AuditAction, string> = {
    LOGIN:          'Connexion',
    LOGOUT:         'Déconnexion',
    LOGIN_FAILED:   'Échec connexion',
    CREATE_USER:    'Création utilisateur',
    UPDATE_USER:    'Modification utilisateur',
    DELETE_USER:    'Suppression utilisateur',
    CREATE_PROJET:  'Création projet',
    UPDATE_PROJET:  'Modification projet',
    DELETE_PROJET:  'Suppression projet',
    ASSIGN:         'Affectation',
    UNASSIGN:       'Annulation affectation',
    ROLE_CHANGE:    'Changement de rôle',
    EXPORT:         'Export',
    PARAMETRES:     'Paramètres système',
  };


  readonly actionGroups: { label: string; actions: AuditAction[] }[] = [
    { label: 'Authentification', actions: ['LOGIN', 'LOGOUT', 'LOGIN_FAILED'] },
    { label: 'Utilisateurs',     actions: ['CREATE_USER', 'UPDATE_USER', 'DELETE_USER', 'ROLE_CHANGE'] },
    { label: 'Projets',          actions: ['CREATE_PROJET', 'UPDATE_PROJET', 'DELETE_PROJET'] },
    { label: 'Affectations',     actions: ['ASSIGN', 'UNASSIGN'] },
    { label: 'Système',          actions: ['EXPORT', 'PARAMETRES'] },
  ];

  ngOnInit(): void {
    this.adminPhoto = localStorage.getItem('smartassign_admin_photo');
    this.loading = true;
    this.auditService.getAuditLogs().subscribe({
      next: (logs) => {
        this.allLogs = logs.map(l => ({
          ...l,
          date: new Date(l.date)
        }));
        this.loading = false;
      },
      error: (err) => {
        this.error = 'Impossible de charger les logs.';
        this.loading = false;
        console.error(err);
      }
    });
  }

  fetchAuditLogs(): void {
    this.loading = true;
    this.error = '';
    this.auditService.getAuditLogs().subscribe({
      next: (logs) => {
        // Conversion date string -> Date si besoin
        this.allLogs = logs.map(l => ({ ...l, date: new Date(l.date) }));
        this.applySort('date');
        this.loading = false;
      },
      error: (err) => {
        this.error = "Erreur lors du chargement des logs d'audit.";
        this.loading = false;
      }
    });
  }

  // ── Computed: filtered + sorted ──────────────────────────
  get filteredLogs(): AuditLog[] {
    const q = this.filterSearch.trim().toLowerCase();
    const df = this.filterDateFrom ? new Date(this.filterDateFrom) : null;
    const dt = this.filterDateTo   ? new Date(this.filterDateTo + 'T23:59:59') : null;

    return this.allLogs
      .filter(l => {
        if (q && !l.user.toLowerCase().includes(q) &&
                 !l.description.toLowerCase().includes(q) &&
                 !l.ip.includes(q) &&
                 !(l.target ?? '').toLowerCase().includes(q)) return false;
        if (this.filterUser   && l.user   !== this.filterUser)   return false;
        if (this.filterAction && l.action !== this.filterAction) return false;
        if (this.filterStatus && l.status !== this.filterStatus) return false;
        if (df && l.date < df) return false;
        if (dt && l.date > dt) return false;
        return true;
      })
      .sort((a, b) => {
        const av = a[this.sortCol];
        const bv = b[this.sortCol];
        if (av instanceof Date && bv instanceof Date) {
          return this.sortDir === 'asc' ? av.getTime() - bv.getTime() : bv.getTime() - av.getTime();
        }
        const as = String(av).toLowerCase();
        const bs = String(bv).toLowerCase();
        if (as < bs) return this.sortDir === 'asc' ? -1 : 1;
        if (as > bs) return this.sortDir === 'asc' ? 1 : -1;
        return 0;
      });
  }

  get pagedLogs(): AuditLog[] {
    const start = (this.currentPage - 1) * this.pageSize;
    return this.filteredLogs.slice(start, start + this.pageSize);
  }

  get totalPages(): number {
    return Math.max(1, Math.ceil(this.filteredLogs.length / this.pageSize));
  }

  get pages(): number[] {
    const total = this.totalPages;
    if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
    const p = this.currentPage;
    if (p <= 4) return [1, 2, 3, 4, 5, -1, total];
    if (p >= total - 3) return [1, -1, total - 4, total - 3, total - 2, total - 1, total];
    return [1, -1, p - 1, p, p + 1, -1, total];
  }

  get successCount(): number  { return this.allLogs.filter(l => l.status === 'SUCCESS').length; }
  get failedCount(): number   { return this.allLogs.filter(l => l.status === 'FAILED').length; }
  get warningCount(): number  { return this.allLogs.filter(l => l.status === 'WARNING').length; }

  get allActions(): AuditAction[] {
    return Object.keys(this.actionLabels) as AuditAction[];
  }

  get todayLogs(): AuditLog[] {
    const today = new Date();
    return this.filteredLogs.filter(l =>
      l.date.getFullYear() === today.getFullYear() &&
      l.date.getMonth() === today.getMonth() &&
      l.date.getDate() === today.getDate()
    );
  }

  get yesterdayLogs(): AuditLog[] {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    return this.filteredLogs.filter(l =>
      l.date.getFullYear() === yesterday.getFullYear() &&
      l.date.getMonth() === yesterday.getMonth() &&
      l.date.getDate() === yesterday.getDate()
    );
  }

  get recentLogs(): AuditLog[] {
    const now = new Date();
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    // Retourner tous les logs des 7 derniers jours excluant today et yesterday
    return this.filteredLogs.filter(l => {
      // Vérifier si le log est dans les 7 derniers jours
      if (l.date < sevenDaysAgo) return false;
      
      // Exclure today
      if (l.date.getFullYear() === now.getFullYear() &&
          l.date.getMonth() === now.getMonth() &&
          l.date.getDate() === now.getDate()) return false;
      
      // Exclure yesterday
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      if (l.date.getFullYear() === yesterday.getFullYear() &&
          l.date.getMonth() === yesterday.getMonth() &&
          l.date.getDate() === yesterday.getDate()) return false;
      
      return true;
    });
  }

  filterByStatus(status: AuditStatus): void {
    this.filterStatus = status;
    this.currentPage = 1;
  }

  evBadgeLabel(action: AuditAction): string {
    if (['LOGIN', 'LOGOUT', 'LOGIN_FAILED'].includes(action)) return 'Connexion';
    if (['CREATE_USER', 'UPDATE_USER', 'DELETE_USER'].includes(action)) return 'Utilisateur';
    if (['CREATE_PROJET', 'UPDATE_PROJET', 'DELETE_PROJET'].includes(action)) return 'Projet';
    if (['ASSIGN', 'UNASSIGN'].includes(action)) return 'Projet';
    if (action === 'ROLE_CHANGE') return 'Rôle';
    if (action === 'PARAMETRES') return 'Paramètre';
    if (action === 'EXPORT') return 'Système';
    return action;
  }

  // ── Actions ───────────────────────────────────────────────
  applySort(col: keyof AuditLog): void {
    if (this.sortCol === col) {
      this.sortDir = this.sortDir === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortCol = col;
      this.sortDir = col === 'date' ? 'desc' : 'asc';
    }
    this.currentPage = 1;
  }

  goToPage(p: number): void {
    if (p < 1 || p > this.totalPages) return;
    this.currentPage = p;
  }

  onFiltersChange(): void {
    this.currentPage = 1;
  }

  resetFilters(): void {
    this.filterSearch   = '';
    this.filterUser     = '';
    this.filterAction   = '';
    this.filterStatus   = '';
    this.filterDateFrom = '';
    this.filterDateTo   = '';
    this.currentPage    = 1;
  }

  openDetail(log: AuditLog): void {
    this.selectedLog = log;
  }

  closeDetail(): void {
    this.selectedLog = null;
  }

  // ── Export ────────────────────────────────────────────────
  exportCsv(): void {
    const header = ['ID', 'Date', 'Heure', 'Utilisateur', 'Rôle', 'Action', 'Description', 'IP', 'Statut', 'Cible'];
    const rows = this.filteredLogs.map(l => [
      l.id,
      this.fmtDate(l.date),
      this.fmtTime(l.date),
      l.user,
      l.userRole,
      l.action,
      l.description,
      l.ip,
      l.status,
      l.target ?? ''
    ]);
    const csv = [header, ...rows].map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(';')).join('\n');
    this.download(`journal_audit_${this.isoDate()}.csv`, '\uFEFF' + csv, 'text/csv;charset=utf-8');
  }

  exportPdf(): void {
    const win = window.open('', '_blank', 'width=1000,height=700');
    if (!win) return;
    const rows = this.filteredLogs.map(l => `
      <tr>
        <td>${l.id}</td>
        <td>${this.fmtDate(l.date)} ${this.fmtTime(l.date)}</td>
        <td>${l.user}</td>
        <td><span class="badge badge-${l.action.toLowerCase().replace(/_/g,'-')}">${l.action}</span></td>
        <td>${l.description}</td>
        <td>${l.ip}</td>
        <td><span class="status status-${l.status.toLowerCase()}">${l.status}</span></td>
      </tr>`).join('');

    win.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8">
      <title>Journal d'audit – SmartAssign</title>
      <style>
        body { font-family: Inter, sans-serif; font-size: 11px; color: #1e293b; padding: 24px; }
        h1   { font-size: 18px; margin-bottom: 4px; }
        p    { color: #64748b; margin-bottom: 16px; font-size: 12px; }
        table{ width: 100%; border-collapse: collapse; }
        th   { background: #f5f7fb; text-align: left; padding: 7px 10px; font-size: 10px; text-transform: uppercase; letter-spacing: .8px; border-bottom: 2px solid #e6ebf2; }
        td   { padding: 7px 10px; border-bottom: 1px solid #e6ebf2; vertical-align: middle; }
        tr:hover td { background: #f8fafc; }
        .status { padding: 2px 8px; border-radius: 4px; font-weight: 700; font-size: 10px; }
        .status-success { background:#ecfdf5; color:#059669; }
        .status-failed  { background:#fef2f2; color:#dc2626; }
        .status-warning { background:#fffbeb; color:#d97706; }
        .badge { font-size: 10px; padding: 2px 7px; border-radius: 4px; background: #eff6ff; color: #2563eb; }
      </style></head><body>
      <h1>Journal d'Audit — SmartAssign</h1>
      <p>Généré le ${new Date().toLocaleDateString('fr-FR', { day:'2-digit', month:'long', year:'numeric', hour:'2-digit', minute:'2-digit' })} · ${this.filteredLogs.length} entrées</p>
      <table><thead><tr><th>#</th><th>Date / Heure</th><th>Utilisateur</th><th>Action</th><th>Description</th><th>IP</th><th>Statut</th></tr></thead>
      <tbody>${rows}</tbody></table></body></html>`);
    win.document.close();
    win.focus();
    win.print();
  }

  // ── Helpers ───────────────────────────────────────────────
  actionLabel(a: AuditAction): string { return this.actionLabels[a] ?? a; }

  actionTone(a: AuditAction): string {
    if (['LOGIN','LOGOUT'].includes(a))                          return 'blue';
    if (a === 'LOGIN_FAILED')                                    return 'red';
    if (['CREATE_USER','CREATE_PROJET'].includes(a))             return 'green';
    if (['UPDATE_USER','UPDATE_PROJET','PARAMETRES'].includes(a)) return 'amber';
    if (['DELETE_USER','DELETE_PROJET'].includes(a))             return 'red';
    if (a === 'ASSIGN')                                          return 'blue';
    if (a === 'UNASSIGN')                                        return 'amber';
    if (a === 'ROLE_CHANGE')                                     return 'violet';
    if (a === 'EXPORT')                                          return 'slate';
    return 'slate';
  }

  actionIcon(a: AuditAction): string {
    const icons: Partial<Record<AuditAction, string>> = {
      LOGIN:         `<path d="M10 14H13a1 1 0 0 0 1-1V3a1 1 0 0 0-1-1H10" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/><path d="M5.5 11l3-3-3-3" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/><path d="M2.5 8H8.5" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>`,
      LOGOUT:        `<path d="M6 14H3a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1h3" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/><path d="M10.5 11l3-3-3-3" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/><path d="M13.5 8H6" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>`,
      LOGIN_FAILED:  `<circle cx="8" cy="8" r="6" stroke="currentColor" stroke-width="1.4"/><path d="M5.5 5.5l5 5M10.5 5.5l-5 5" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>`,
      CREATE_USER:   `<circle cx="8" cy="5.5" r="2.5" stroke="currentColor" stroke-width="1.4"/><path d="M2 13.5c0-2.761 2.686-5 6-5s6 2.239 6 5" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>`,
      UPDATE_USER:   `<circle cx="8" cy="5.5" r="2.5" stroke="currentColor" stroke-width="1.4"/><path d="M2 13.5c0-2.761 2.686-5 6-5s6 2.239 6 5" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/><path d="M12 12l1.5 1.5-2 2" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/>`,
      DELETE_USER:   `<circle cx="8" cy="5.5" r="2.5" stroke="currentColor" stroke-width="1.4"/><path d="M2 13.5c0-2.761 2.686-5 6-5s6 2.239 6 5" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/><path d="M11 11.5l3 3M14 11.5l-3 3" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>`,
      CREATE_PROJET: `<rect x="2" y="2" width="12" height="12" rx="2" stroke="currentColor" stroke-width="1.4"/><path d="M8 5v6M5 8h6" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>`,
      UPDATE_PROJET: `<rect x="2" y="2" width="12" height="12" rx="2" stroke="currentColor" stroke-width="1.4"/><path d="M5 8h6" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>`,
      DELETE_PROJET: `<rect x="2" y="2" width="12" height="12" rx="2" stroke="currentColor" stroke-width="1.4"/><path d="M5.5 5.5l5 5M10.5 5.5l-5 5" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>`,
      ASSIGN:        `<path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>`,
      UNASSIGN:      `<path d="M13 8H3M7 4l-4 4 4 4" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>`,
      ROLE_CHANGE:   `<path d="M8 1.5L14 4v4c0 3.5-2.5 5.5-6 6.5C2.5 13.5 0 11.5 0 8V4l6-2.5Z" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/>`,
      EXPORT:        `<path d="M8 2v8M4 6l4 4 4-4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><path d="M2 12h12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>`,
      PARAMETRES:    `<circle cx="8" cy="8" r="2" stroke="currentColor" stroke-width="1.4"/><path d="M8 2v1M8 13v1M2 8h1M13 8h1M3.5 3.5l.7.7M11.8 11.8l.7.7M3.5 12.5l.7-.7M11.8 4.2l.7-.7" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>`,
    };
    return icons[a] ?? `<circle cx="8" cy="8" r="5" stroke="currentColor" stroke-width="1.4"/>`;
  }

  private fmtDate(d: Date): string {
    return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  }
  private fmtTime(d: Date): string {
    return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  }
  private isoDate(): string {
    return new Date().toISOString().slice(0, 10);
  }
  private download(name: string, data: string, mime: string): void {
    const blob = new Blob([data], { type: mime });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url; a.download = name; a.click();
    URL.revokeObjectURL(url);
  }
}
