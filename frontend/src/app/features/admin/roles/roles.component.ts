import { Component, OnInit, ChangeDetectorRef, ElementRef, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../../services/auth';
import { AdminSidebarComponent } from '../shared/admin-sidebar.component';

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
  imports: [CommonModule, FormsModule, AdminSidebarComponent],
  templateUrl: './roles.component.html',
  styleUrl: './roles.component.scss'
})
export class AdminRolesComponent implements OnInit {

  currentDate = new Date();
  activeTab: 'predefined' | 'custom' = 'predefined';

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

  // ── View expanded role permissions ───────────────────────────
  expandedRoleId: string | null = null;

  // ── Toast ────────────────────────────────────────────────────
  toastMessage = '';
  private toastTimer?: ReturnType<typeof setTimeout>;

  constructor(
    private cdr: ChangeDetectorRef,
    private authService: AuthService,
    private router: Router,
    private elRef: ElementRef
  ) {}

  ngOnInit(): void {
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

  deniedPerms(role: PredefinedRole): RolePermission[] {
    return role.permissions.filter(p => !p.granted);
  }

  toggleExpand(id: string): void {
    this.expandedRoleId = this.expandedRoleId === id ? null : id;
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

  // ── Export ───────────────────────────────────────────────────

  exportRoles(): void {
    const header = 'Nom,Description,Utilisateurs,Date création';
    const rows = this.customRoles.map(r =>
      [r.name, r.description, r.usersCount, r.createdAt.toLocaleDateString('fr-FR')].join(',')
    );
    const csv = [header, ...rows].join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'roles.csv'; a.click();
    URL.revokeObjectURL(url);
  }

  exportPdf(): void {
    window.print();
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
