import { Component, OnInit, ChangeDetectorRef, ElementRef, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { catchError, of } from 'rxjs';
import { AuthService } from '../../../services/auth';
import { AdminSidebarComponent } from '../shared/admin-sidebar.component';
import { AdminTopbarComponent } from '../shared/admin-topbar.component';
import { AdminCollaborateurService, AdminRole, AdminRolesService, Collaborateur, RoleMember } from '../../../services/admin';

// ── Types ─────────────────────────────────────────────────────

export interface Permission {
  id: string;
  label: string;
  category: string;
}

export interface RolePermission {
  id: string;
  label: string;
  granted: boolean;
}

export interface PredefinedRole {
  id: string;
  name: string;
  description: string;
  icon: 'admin' | 'manager' | 'collab';
  color: 'violet' | 'blue' | 'green';
  usersCount: number;
  permissions: RolePermission[];
  members: RoleMember[];
  isSystem: true;
}

export interface CustomRole {
  id: string;
  name: string;
  description: string;
  usersCount: number;
  createdAt: Date;
  mainPermissions: string[];
  isSystem: false;
}

export interface PermissionCategory {
  id: string;
  label: string;
  permissions: { id: string; label: string }[];
}

// ── Mock data ─────────────────────────────────────────────────

const PREDEFINED_ROLES: PredefinedRole[] = [
  {
    id: 'admin',
    name: 'Administrateur',
    description: 'Contrôle global de la plateforme',
    icon: 'admin',
    color: 'violet',
    usersCount: 2,
    isSystem: true,
    members: [],
    permissions: [
      { id: 'manage_users',       label: 'Gérer utilisateurs',         granted: true  },
      { id: 'manage_roles',       label: 'Gérer rôles',                granted: true  },
      { id: 'config_permissions', label: 'Configurer permissions',     granted: true  },
      { id: 'view_audit',         label: 'Voir journal audit',         granted: true  },
      { id: 'system_settings',    label: 'Paramètres système',         granted: true  },
      { id: 'readonly_super',     label: 'Supervision lecture seule',  granted: true  },
      { id: 'create_projects',    label: 'Créer projets',              granted: false },
      { id: 'assign_collabs',     label: 'Affecter collaborateurs',    granted: false },
      { id: 'edit_assignments',   label: 'Modifier affectations',      granted: false },
    ]
  },
  {
    id: 'manager',
    name: 'Manager',
    description: 'Gestion des projets et équipes',
    icon: 'manager',
    color: 'blue',
    usersCount: 9,
    isSystem: true,
    members: [],
    permissions: [
      { id: 'create_projects',    label: 'Créer projets',              granted: true  },
      { id: 'edit_projects',      label: 'Modifier projets',           granted: true  },
      { id: 'assign_collabs',     label: 'Affecter collaborateurs',    granted: true  },
      { id: 'view_ai',            label: 'Voir suggestions IA',        granted: true  },
      { id: 'track_assignments',  label: 'Suivi affectations',         granted: true  },
      { id: 'manage_users',       label: 'Gérer utilisateurs',         granted: false },
      { id: 'manage_roles',       label: 'Gérer rôles',                granted: false },
      { id: 'system_settings',    label: 'Paramètres système',         granted: false },
    ]
  },
  {
    id: 'collab',
    name: 'Collaborateur',
    description: 'Accès personnel et consultation',
    icon: 'collab',
    color: 'green',
    usersCount: 41,
    isSystem: true,
    members: [],
    permissions: [
      { id: 'view_own_projects',  label: 'Voir ses projets',           granted: true  },
      { id: 'view_planning',      label: 'Consulter planning',         granted: true  },
      { id: 'view_competences',   label: 'Voir compétences',           granted: true  },
      { id: 'edit_projects',      label: 'Modifier projets',           granted: false },
      { id: 'assign_resources',   label: 'Affecter ressources',        granted: false },
      { id: 'admin_access',       label: 'Accès administration',       granted: false },
    ]
  }
];

const CUSTOM_ROLES: CustomRole[] = [
  {
    id: 'rh',
    name: 'RH',
    description: 'Gestion des ressources humaines',
    usersCount: 3,
    createdAt: new Date('2025-11-10'),
    mainPermissions: ['Voir utilisateurs', 'Créer utilisateur', 'Modifier utilisateur'],
    isSystem: false,
  },
  {
    id: 'auditeur',
    name: 'Auditeur',
    description: 'Consultation et audit des activités',
    usersCount: 1,
    createdAt: new Date('2025-12-05'),
    mainPermissions: ['Voir audit logs', 'Voir analytics', 'Export CSV'],
    isSystem: false,
  },
  {
    id: 'support',
    name: 'Support',
    description: 'Support technique et assistance utilisateurs',
    usersCount: 4,
    createdAt: new Date('2026-01-20'),
    mainPermissions: ['Voir utilisateurs', 'Voir projets', 'Voir affectations'],
    isSystem: false,
  },
  {
    id: 'observateur',
    name: 'Observateur',
    description: 'Accès lecture seule à la plateforme',
    usersCount: 2,
    createdAt: new Date('2026-03-08'),
    mainPermissions: ['Voir projets', 'Voir analytics'],
    isSystem: false,
  }
];

const ALL_PERMISSION_CATEGORIES: PermissionCategory[] = [
  {
    id: 'users',
    label: 'Utilisateurs',
    permissions: [
      { id: 'view_users',    label: 'Voir utilisateurs'    },
      { id: 'create_users',  label: 'Créer utilisateur'    },
      { id: 'edit_users',    label: 'Modifier utilisateur' },
      { id: 'suspend_users', label: 'Suspendre utilisateur'},
    ]
  },
  {
    id: 'projects',
    label: 'Projets',
    permissions: [
      { id: 'view_projects',   label: 'Voir projets'    },
      { id: 'create_projects', label: 'Créer projets'   },
      { id: 'edit_projects',   label: 'Modifier projets'},
      { id: 'delete_projects', label: 'Supprimer projets'},
    ]
  },
  {
    id: 'assignments',
    label: 'Affectations',
    permissions: [
      { id: 'view_assignments',     label: 'Voir affectations'       },
      { id: 'assign_collabs',       label: 'Affecter collaborateurs' },
      { id: 'validate_ai',          label: 'Valider affectations IA' },
    ]
  },
  {
    id: 'admin',
    label: 'Administration',
    permissions: [
      { id: 'view_audit',       label: 'Voir audit logs'    },
      { id: 'manage_roles',     label: 'Gérer rôles'        },
      { id: 'system_settings',  label: 'Paramètres système' },
    ]
  },
  {
    id: 'reports',
    label: 'Rapports',
    permissions: [
      { id: 'view_analytics', label: 'Voir analytics' },
      { id: 'export_csv',     label: 'Export CSV'      },
    ]
  }
];

@Component({
  selector: 'app-admin-roles',
  standalone: true,
  imports: [CommonModule, FormsModule, AdminSidebarComponent, AdminTopbarComponent],
  templateUrl: './roles.component.html',
  styleUrl: './roles.component.scss'
})
export class AdminRolesComponent implements OnInit {

  currentDate = new Date();
  today = new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  activeTab: 'predefined' | 'custom' = 'predefined';
  adminPhoto: string | null = null;

  predefinedRoles = PREDEFINED_ROLES;
  customRoles     = CUSTOM_ROLES;
  permissionCategories = ALL_PERMISSION_CATEGORIES;

  // ── Custom roles table state ─────────────────────────────────
  searchTerm  = '';
  currentPage = 1;
  pageSize    = 5;
  userMenuOpen = false;

  // ── Edit predefined role modal ────────────────────────────────
  editingRole: PredefinedRole | null = null;
  editRoleName = '';
  editRoleDesc = '';
  editRolePerms: Record<string, boolean> = {};

  readonly editSimplePermissions = [
    { id: 'manage_users',       label: 'Gérer utilisateurs'       },
    { id: 'manage_roles',       label: 'Gérer rôles'              },
    { id: 'config_permissions', label: 'Configurer permissions'   },
    { id: 'view_audit',         label: 'Voir journal audit'       },
    { id: 'system_settings',    label: 'Paramètres système'       },
    { id: 'supervision',        label: 'Supervision lecture seule'},
    { id: 'create_projects',    label: 'Créer projets'           },
    { id: 'assign_collabs',     label: 'Affecter collaborateurs'  },
    { id: 'edit_assignments',   label: 'Modifier affectations'    },
  ];

  // ── Create modal ─────────────────────────────────────────────
  showCreateModal  = false;
  newRoleName      = '';
  newRoleDesc      = '';
  newRolePerms: Record<string, boolean> = {};

  readonly simplePermissions = [
    { id: 'view_audit',      label: 'Voir journal audit'  },
    { id: 'manage_users',    label: 'Gérer utilisateurs'  },
    { id: 'create_projects', label: 'Créer projets'       },
    { id: 'view_analytics',  label: 'Voir rapports'       },
    { id: 'system_settings', label: 'Paramètres système'  },
    { id: 'supervision',     label: 'Supervision'         },
  ];

  // ── Delete modal ─────────────────────────────────────────────
  deleteTarget: CustomRole | null = null;
  deletePredefinedTarget: PredefinedRole | null = null;

  // ── View role modal (predefined) ─────────────────────────────
  viewedRole: PredefinedRole | null = null;

  // ── Expand/collapse members list by role ─────────────────────
  expandedRole: string | null = null;

  // ── Toast ────────────────────────────────────────────────────
  toastMessage = '';
  private toastTimer?: ReturnType<typeof setTimeout>;

  constructor(
    private cdr: ChangeDetectorRef,
    private readonly rolesService: AdminRolesService,
    private readonly adminCollaborateurService: AdminCollaborateurService,
    private authService: AuthService,
    private router: Router,
    private elRef: ElementRef
  ) {}

  ngOnInit(): void {
    this.adminPhoto = this.authService.currentUser?.photoUrl ?? null;
    this.loadRoles();
    this.loadMembersFromUsers();
    // initialise all permission checkboxes to false
    this.resetNewRolePerms();
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (!this.elRef.nativeElement.contains(event.target)) {
      this.userMenuOpen = false;
    }
  }

  // ── Getters ──────────────────────────────────────────────────

  get filteredCustomRoles(): CustomRole[] {
    const s = this.searchTerm.trim().toLowerCase();
    if (!s) return this.customRoles;
    return this.customRoles.filter(r =>
      r.name.toLowerCase().includes(s) ||
      r.description.toLowerCase().includes(s)
    );
  }

  get paginatedCustomRoles(): CustomRole[] {
    const start = (this.currentPage - 1) * this.pageSize;
    return this.filteredCustomRoles.slice(start, start + this.pageSize);
  }

  get totalPages(): number {
    return Math.max(1, Math.ceil(this.filteredCustomRoles.length / this.pageSize));
  }

  get pageNumbers(): number[] {
    return Array.from({ length: this.totalPages }, (_, i) => i + 1);
  }

  get selectedPermCount(): number {
    return Object.values(this.newRolePerms).filter(Boolean).length;
  }

  // ── Helpers ──────────────────────────────────────────────────

  grantedCount(role: PredefinedRole): number {
    return role.permissions.filter(p => p.granted).length;
  }

  private loadRoles(): void {
    this.rolesService.getRoles().pipe(
      catchError(() => of([] as AdminRole[]))
    ).subscribe((roles) => {
      if (!roles.length) {
        return;
      }

      this.predefinedRoles = roles.map((role) => ({
        id: role.id,
        name: role.name,
        description: this.getDisplayDescription(role.code),
        icon: this.toRoleIcon(role.icon),
        color: this.toRoleColor(role.color),
        usersCount: role.usersCount,
        isSystem: true,
        members: role.members ?? [],
        permissions: this.getDisplayPermissions(role.code, role.permissions)
      }));

      this.cdr.detectChanges();
    });
  }

  private toRoleIcon(icon: string): PredefinedRole['icon'] {
    if (icon === 'admin' || icon === 'manager' || icon === 'collab') {
      return icon;
    }
    return 'collab';
  }

  private loadMembersFromUsers(): void {
    this.adminCollaborateurService.getAll().pipe(
      catchError(() => of([] as Collaborateur[]))
    ).subscribe((users) => {
      if (!users.length) {
        return;
      }

      const membersByRole: Record<string, RoleMember[]> = {
        admin: [],
        manager: [],
        collab: [],
      };

      users.forEach((user) => {
        const roleId = this.normalizeRoleId(user.role);
        membersByRole[roleId].push({
          id: Number(user.id ?? 0),
          prenom: user.prenom,
          nom: user.nom,
          email: user.email,
          role: user.role,
          statutCompte: user.statutCompte ?? 'ACTIF',
        });
      });

      this.predefinedRoles = this.predefinedRoles.map((role) => {
        const roleMembers = membersByRole[role.id] ?? [];
        return {
          ...role,
          members: roleMembers,
          usersCount: roleMembers.length,
        };
      });

      this.cdr.detectChanges();
    });
  }

  private normalizeRoleId(role: string | undefined): 'admin' | 'manager' | 'collab' {
    const normalized = (role ?? '').trim().toUpperCase();

    if (normalized.includes('ADMIN')) {
      return 'admin';
    }

    if (normalized.includes('MANAGER')) {
      return 'manager';
    }

    return 'collab';
  }

  private toRoleColor(color: string): PredefinedRole['color'] {
    if (color === 'violet' || color === 'blue' || color === 'green') {
      return color;
    }
    return 'green';
  }

  private getDisplayDescription(roleCode: string): string {
    const normalizedCode = roleCode.toUpperCase();
    if (normalizedCode === 'ADMIN') {
      return 'Contrôle total de la plateforme';
    }
    if (normalizedCode === 'MANAGER') {
      return 'Gestion des projets et équipes';
    }
    return 'Accès personnel et consultation';
  }

  private getDisplayPermissions(roleCode: string, grantedPermissions: AdminRole['permissions']): RolePermission[] {
    const fallbackRole = PREDEFINED_ROLES.find((role) => role.id === roleCode.toLowerCase());
    if (!fallbackRole) {
      return grantedPermissions.map((perm) => ({
        id: perm.id,
        label: perm.label,
        granted: !!perm.granted,
      }));
    }

    const grantedIds = new Set(
      grantedPermissions
        .filter((perm) => perm.granted)
        .map((perm) => perm.id)
    );

    return fallbackRole.permissions.map((perm) => ({
      id: perm.id,
      label: perm.label,
      granted: grantedIds.has(perm.id)
    }));
  }

  toggleUserMenu(): void {
    this.userMenuOpen = !this.userMenuOpen;
  }

  navigateTo(path: string): void {
    this.userMenuOpen = false;
    void this.router.navigate([path]);
  }

  logout(): void {
    this.authService.logout();
    void this.router.navigate(['/login']);
  }

  goToPage(page: number): void {
    if (page >= 1 && page <= this.totalPages) {
      this.currentPage = page;
    }
  }

  min(a: number, b: number): number { return Math.min(a, b); }

  grantedPerms(role: PredefinedRole): RolePermission[] {
    return role.permissions.filter(p => p.granted);
  }

  exporterCSV(): void {
    const data = this.predefinedRoles.map(r => ({
      'Rôle': r.name,
      'Description': r.description,
      'Comptes': r.usersCount,
      'Permissions accordées': r.permissions.filter(p => p.granted).map(p => p.label).join('; ')
    }));
    const csv = [
      Object.keys(data[0]).join(','),
      ...data.map(row => Object.values(row).map(v => `"${v}"`).join(','))
    ].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `roles-permissions-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  }

  exportPdf(): void {
    const title = 'Rôles & Permissions';
    const subtitle = `Rapport généré le ${new Date().toLocaleDateString('fr-FR')}`;
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8">
          <style>
            body { font-family: Arial, sans-serif; padding: 40px; color: #111827; }
            h1 { font-size: 24px; font-weight: 600; margin-bottom: 4px; }
            .subtitle { color: #6B7280; font-size: 14px; margin-bottom: 24px; }
            table { width: 100%; border-collapse: collapse; margin-top: 16px; }
            th { background: #F3F4F6; padding: 12px; text-align: left; font-weight: 600; border-bottom: 1px solid #E5E7EB; }
            td { padding: 12px; border-bottom: 1px solid #E5E7EB; }
          </style>
        </head>
        <body>
          <h1>${title}</h1>
          <p class="subtitle">${subtitle}</p>
          <table>
            <thead>
              <tr>
                <th>Rôle</th>
                <th>Description</th>
                <th>Comptes</th>
                <th>Permissions accordées</th>
              </tr>
            </thead>
            <tbody>
              ${this.predefinedRoles.map(r => `
                <tr>
                  <td>${r.name}</td>
                  <td>${r.description}</td>
                  <td>${r.usersCount}</td>
                  <td>${r.permissions.filter(p => p.granted).map(p => p.label).join('; ')}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </body>
      </html>
    `;
    const printWindow = window.open('', '', 'height=600,width=1000');
    if (printWindow) {
      printWindow.document.write(html);
      printWindow.document.close();
      setTimeout(() => {
        printWindow.print();
        printWindow.close();
      }, 250);
    }
  }

  deniedPerms(role: PredefinedRole): RolePermission[] {
    return role.permissions.filter(p => !p.granted);
  }

  toggleRole(roleId: string): void {
    this.expandedRole = this.expandedRole === roleId ? null : roleId;
  }

  getRoleMembers(role: PredefinedRole): RoleMember[] {
    return role.members ?? [];
  }

  memberDisplayName(member: RoleMember): string {
    const prenom = (member.prenom ?? '').trim();
    const nom = (member.nom ?? '').trim();

    if (prenom && nom) {
      return `${prenom} ${nom}`.trim();
    }

    return nom || member.email;
  }

  memberInitiales(member: RoleMember): string {
    const name = this.memberDisplayName(member).trim();
    const parts = name.split(/\s+/).filter(Boolean);

    if (!parts.length) {
      return '?';
    }

    const first = parts[0]?.[0] ?? '';
    const second = (parts.length > 1 ? parts[1]?.[0] : parts[0]?.[1]) ?? '';
    return `${first}${second}`.toUpperCase();
  }

  isMemberActif(member: RoleMember): boolean {
    return (member.statutCompte ?? 'ACTIF') !== 'SUSPENDU';
  }

  // ── View predefined role (modal) ─────────────────────────────
  openViewRole(role: PredefinedRole): void { this.viewedRole = role; }
  closeViewRole(): void { this.viewedRole = null; }
  editFromViewRole(): void {
    const r = this.viewedRole;
    this.viewedRole = null;
    if (r) this.openEditRoleModal(r);
  }

  // ── Delete predefined role ───────────────────────────────────
  openDeletePredefined(role: PredefinedRole): void {
    this.deletePredefinedTarget = role;
  }
  closeDeletePredefined(): void {
    this.deletePredefinedTarget = null;
  }
  confirmDeletePredefined(): void {
    if (!this.deletePredefinedTarget) return;
    const name = this.deletePredefinedTarget.name;
    this.predefinedRoles = this.predefinedRoles.filter(r => r.id !== this.deletePredefinedTarget!.id);
    this.deletePredefinedTarget = null;
    this.showToast(`Rôle « ${name} » supprimé.`);
    this.cdr.detectChanges();
  }

  /** Emoji-style icon for predefined roles (used in cards & modals). */
  roleEmoji(role: PredefinedRole): string {
    if (role.icon === 'admin')   return '⭐';
    if (role.icon === 'manager') return '💼';
    return '👤';
  }

  // ── Edit predefined role ─────────────────────────────────────

  openEditRoleModal(role: PredefinedRole): void {
    this.editingRole = role;
    this.editRoleName = role.name;
    this.editRoleDesc = role.description;
    // Pre-fill checkboxes from all permission categories
    this.editRolePerms = {};
    for (const cat of this.permissionCategories) {
      for (const perm of cat.permissions) {
        const found = role.permissions.find(p => p.id === perm.id);
        this.editRolePerms[perm.id] = found ? found.granted : false;
      }
    }
  }

  closeEditRoleModal(): void {
    this.editingRole = null;
  }

  saveEditRole(): void {
    if (!this.editingRole) return;
    const role = this.predefinedRoles.find(r => r.id === this.editingRole!.id);
    if (role) {
      role.name = this.editRoleName.trim() || role.name;
      role.description = this.editRoleDesc.trim() || role.description;
      // Update permissions
      for (const cat of this.permissionCategories) {
        for (const perm of cat.permissions) {
          const existing = role.permissions.find(p => p.id === perm.id);
          if (existing) {
            existing.granted = !!this.editRolePerms[perm.id];
          } else if (this.editRolePerms[perm.id]) {
            role.permissions.push({ id: perm.id, label: perm.label, granted: true });
          }
        }
      }
    }
    this.closeEditRoleModal();
    this.showToast(`Rôle « ${this.editRoleName} » mis à jour.`);
    this.cdr.detectChanges();
  }

  // ── Create role ──────────────────────────────────────────────

  openCreateModal(): void {
    this.newRoleName = '';
    this.newRoleDesc = '';
    this.resetNewRolePerms();
    this.showCreateModal = true;
  }

  closeCreateModal(): void {
    this.showCreateModal = false;
  }

  createRole(): void {
    if (!this.newRoleName.trim()) return;

    const selectedPerms = Object.entries(this.newRolePerms)
      .filter(([, v]) => v)
      .map(([k]) => {
        for (const cat of this.permissionCategories) {
          const p = cat.permissions.find(p => p.id === k);
          if (p) return p.label;
        }
        return k;
      })
      .filter(Boolean)
      .slice(0, 3);

    const newRole: CustomRole = {
      id: `role_${Date.now()}`,
      name: this.newRoleName.trim(),
      description: this.newRoleDesc.trim() || 'Rôle personnalisé',
      usersCount: 0,
      createdAt: new Date(),
      mainPermissions: selectedPerms,
      isSystem: false,
    };

    this.customRoles = [newRole, ...this.customRoles];
    this.closeCreateModal();
    this.showToast(`Rôle « ${newRole.name} » créé avec succès.`);
    this.cdr.detectChanges();
  }

  // ── Duplicate role ───────────────────────────────────────────

  duplicateRole(role: CustomRole): void {
    const copy: CustomRole = {
      ...role,
      id: `role_${Date.now()}`,
      name: `${role.name} (copie)`,
      usersCount: 0,
      createdAt: new Date(),
      isSystem: false,
    };
    this.customRoles = [...this.customRoles, copy];
    this.showToast(`Rôle « ${copy.name} » dupliqué.`);
    this.cdr.detectChanges();
  }

  // ── Delete role ──────────────────────────────────────────────

  openDeleteModal(role: CustomRole): void {
    this.deleteTarget = role;
  }

  closeDeleteModal(): void {
    this.deleteTarget = null;
  }

  confirmDelete(): void {
    if (!this.deleteTarget) return;
    const name = this.deleteTarget.name;
    this.customRoles = this.customRoles.filter(r => r.id !== this.deleteTarget!.id);
    this.deleteTarget = null;
    this.showToast(`Rôle « ${name} » supprimé.`);
    this.cdr.detectChanges();
  }



  // ── Toast ────────────────────────────────────────────────────

  private showToast(msg: string): void {
    if (this.toastTimer) clearTimeout(this.toastTimer);
    this.toastMessage = msg;
    this.toastTimer = setTimeout(() => {
      this.toastMessage = '';
      this.cdr.detectChanges();
    }, 3000);
  }

  // ── Private ──────────────────────────────────────────────────

  private resetNewRolePerms(): void {
    this.newRolePerms = {};
    for (const cat of this.permissionCategories) {
      for (const p of cat.permissions) {
        this.newRolePerms[p.id] = false;
      }
    }
  }

  toggleAllCategoryPerms(catId: string, value: boolean): void {
    const cat = this.permissionCategories.find(c => c.id === catId);
    if (!cat) return;
    for (const p of cat.permissions) {
      this.newRolePerms[p.id] = value;
    }
  }

  isCategoryAllSelected(catId: string): boolean {
    const cat = this.permissionCategories.find(c => c.id === catId);
    if (!cat) return false;
    return cat.permissions.every(p => this.newRolePerms[p.id]);
  }
}
