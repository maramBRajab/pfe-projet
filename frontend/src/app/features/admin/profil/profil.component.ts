import { CommonModule } from '@angular/common';
import { Component, ElementRef, OnInit, ViewChild } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';

import { ProfileData, ProfileDetailItem, ProfileDetailSection, ProfileFeedbackTone, ProfileHighlightCard, ProfilePermission, ProfileSaveValue, ProfileStat } from '../../../shared/models/profile.model';
import { AdminSidebarComponent } from '../shared/admin-sidebar.component';
import { AdminTopbarComponent } from '../shared/admin-topbar.component';
import { AuthService } from '../../../services/auth';

interface LocalProfileExtras {
  phone: string;
  position: string;
  roleSpecificField: string;
}

@Component({
  selector: 'app-admin-profil',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, AdminSidebarComponent],
  templateUrl: './profil.component.html',
  styleUrl: './profil.component.scss'
})
export class AdminProfilComponent implements OnInit {
  @ViewChild('firstNameField')
  private firstNameField?: ElementRef<HTMLInputElement>;

  profileData?: Partial<ProfileData>;
  feedbackMessage = '';
  feedbackTone: ProfileFeedbackTone = 'neutral';
  passwordFeedbackMessage = '';
  passwordFeedbackTone: ProfileFeedbackTone = 'neutral';
  isSaving = false;
  photoUrl: string | null = null;
  adminPhoto: string | null = null;

  readonly profileForm = new FormGroup({
    firstName: new FormControl('', { nonNullable: true }),
    lastName: new FormControl('', { nonNullable: true }),
    email: new FormControl('', { nonNullable: true }),
    phone: new FormControl('', { nonNullable: true }),
    position: new FormControl('', { nonNullable: true }),
    roleSpecificField: new FormControl('', { nonNullable: true })
  });

  readonly passwordForm = new FormGroup({
    currentPassword: new FormControl('', { nonNullable: true }),
    newPassword: new FormControl('', { nonNullable: true }),
    confirmPassword: new FormControl('', { nonNullable: true })
  });

  readonly roleSpecificLabel = 'Departement';
  readonly roleLabel = 'Administrateur';
  readonly roleBadge = 'Admin';

  readonly stats: ProfileStat[] = [
    { label: 'Managers actifs', value: '12' },
    { label: 'Collaborateurs', value: '84' },
    { label: 'Projets en cours', value: '18' },
    { label: 'Alertes système', value: '03' }
  ];

  readonly permissions: ProfilePermission[] = [
    { label: 'Gestion des utilisateurs', allowed: true },
    { label: 'Affectation des rôles', allowed: true },
    { label: 'Configuration système', allowed: true },
    { label: 'Accès aux rapports globaux', allowed: true },
    { label: 'Export des données', allowed: true },
    { label: 'Supervision plateforme', allowed: true }
  ];

  readonly highlightCards: ProfileHighlightCard[] = [
    {
      label: 'Utilisateurs',
      value: '84 comptes',
      hint: 'Population suivie sur l ensemble de la plateforme SmartAssign.'
    },
    {
      label: 'Roles actifs',
      value: '3 profils',
      hint: 'Admin, Manager et Collaborateur geres depuis le meme referentiel.'
    },
    {
      label: 'Supervision',
      value: '18 projets',
      hint: 'Vue transverse sur l activite et les configurations sensibles.'
    },
    {
      label: 'Alertes systeme',
      value: '3 ouvertes',
      hint: 'Points de vigilance detectes sur les affectations et les capacites.'
    }
  ];

  readonly detailSections: ProfileDetailSection[] = [
    {
      kicker: 'Gouvernance',
      title: 'Priorites administrateur',
      emptyState: 'Aucune priorite d administration a afficher.',
      items: [
        {
          title: 'Controle des acces',
          subtitle: 'Les droits managers et collaborateurs restent alignes avec la politique courante.',
          meta: 'Derniere revision effectuee aujourd hui',
          badge: 'Conforme',
          tone: 'success'
        },
        {
          title: 'Integrite des donnees',
          subtitle: 'Les profils, projets et affectations sont synchronises sur les modules critiques.',
          meta: 'Journal de suivi et exports disponibles',
          badge: 'Surveille'
        },
        {
          title: 'Revue des anomalies',
          subtitle: 'Quelques alertes demandent une verification avant la prochaine cloture hebdomadaire.',
          meta: 'Verifier les tensions sur les profils backend et data',
          badge: 'A verifier',
          tone: 'warning'
        }
      ]
    },
    {
      kicker: 'Portee',
      title: 'Capacites du role',
      emptyState: 'Aucune capacite specifique a afficher.',
      items: [
        {
          title: 'Gestion des comptes',
          subtitle: 'Creation, edition, desactivation et supervision des utilisateurs de la plateforme.',
          meta: 'Controle direct du cycle de vie des comptes',
          badge: 'Total',
          tone: 'success'
        },
        {
          title: 'Configuration plateforme',
          subtitle: 'Parametrage global des regles, referentiels et comportements critiques.',
          meta: 'Niveau de permission reserve a l administration',
          badge: 'Total',
          tone: 'success'
        },
        {
          title: 'Arbitrage operationnel',
          subtitle: 'La validation quotidienne des affectations reste deleguee aux managers.',
          meta: 'Supervision globale sans substitution du pilotage local',
          badge: 'Delegue',
          tone: 'warning'
        }
      ]
    }
  ];

  constructor(
    private readonly authService: AuthService,
    private readonly router: Router
  ) {}

  ngOnInit(): void {
    this.adminPhoto = localStorage.getItem('smartassign_admin_photo');
    this.reloadProfile();
    const saved = localStorage.getItem('smartassign_admin_photo');
    if (saved) this.photoUrl = saved;
  }

  logout(): void {
    this.authService.logout();
    void this.router.navigate(['/login']);
  }

  get currentProfile(): Partial<ProfileData> {
    return this.profileData ?? {};
  }

  get currentFullName(): string {
    return `${this.currentProfile.firstName ?? ''} ${this.currentProfile.lastName ?? ''}`.trim() || 'Admin Principal';
  }

  get currentInitials(): string {
    return this.computeInitials(this.currentFullName, 'AP');
  }

  get allowedPermissionsCount(): number {
    return this.permissions.filter((permission) => permission.allowed).length;
  }

  private readonly permIconMap: Record<string, string> = {
    'Gestion des utilisateurs': 'ti-users',
    'Affectation des r\u00f4les':   'ti-shield-check',
    'Configuration syst\u00e8me':    'ti-settings',
    'Acc\u00e8s aux rapports globaux': 'ti-chart-bar',
    'Export des donn\u00e9es':        'ti-download',
    'Supervision plateforme':     'ti-eye'
  };

  get permissionsWithIcons(): Array<{ label: string; allowed: boolean; icon: string }> {
    return this.permissions.map(p => ({
      ...p,
      icon: this.permIconMap[p.label] ?? 'ti-check'
    }));
  }

  get permissionSummary(): string {
    return `${this.allowedPermissionsCount}/${this.permissions.length} permissions`;
  }

  get profileEmail(): string {
    return this.currentProfile.email ?? 'admin@smartassign.tn';
  }

  reloadProfile(): void {
    this.profileData = this.buildProfileData();
    this.syncProfileForm();
    this.passwordForm.reset();
    this.feedbackMessage = '';
    this.feedbackTone = 'neutral';
    this.passwordFeedbackMessage = '';
    this.passwordFeedbackTone = 'neutral';
  }

  onPhotoChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      this.photoUrl = reader.result as string;
      localStorage.setItem('smartassign_admin_photo', this.photoUrl);
    };
    reader.readAsDataURL(file);
  }

  focusForm(): void {
    setTimeout(() => this.firstNameField?.nativeElement.focus());
  }

  onSave(): void {
    this.saveProfile({
      role: 'admin',
      ...this.profileForm.getRawValue()
    });
  }

  onPasswordSave(): void {
    const { currentPassword, newPassword, confirmPassword } = this.passwordForm.getRawValue();
    this.passwordFeedbackMessage = '';
    this.passwordFeedbackTone = 'neutral';

    if (!currentPassword || !newPassword || !confirmPassword) {
      this.passwordFeedbackMessage = 'Tous les champs sont obligatoires.';
      this.passwordFeedbackTone = 'error'; return;
    }
    if (newPassword.length < 8) {
      this.passwordFeedbackMessage = 'Minimum 8 caractères.';
      this.passwordFeedbackTone = 'error'; return;
    }
    if (newPassword !== confirmPassword) {
      this.passwordFeedbackMessage = 'La confirmation ne correspond pas.';
      this.passwordFeedbackTone = 'error'; return;
    }
    if (currentPassword === newPassword) {
      this.passwordFeedbackMessage = "Le nouveau mot de passe doit être différent de l'actuel.";
      this.passwordFeedbackTone = 'error'; return;
    }

    this.authService.changePassword({
      motDePasseActuel: currentPassword,
      nouveauMotDePasse: newPassword,
      confirmationMotDePasse: confirmPassword
    }).subscribe({
      next: () => {
        this.passwordFeedbackMessage = 'Mot de passe modifié avec succès.';
        this.passwordFeedbackTone = 'success';
        this.passwordForm.reset();
      },
      error: (err: { error?: { message?: string } }) => {
        this.passwordFeedbackMessage = err?.error?.message ?? 'Erreur.';
        this.passwordFeedbackTone = 'error';
      }
    });
  }

  kpiTone(index: number): 'green' | 'cyan' | 'amber' | 'default' {
    if (index === 1) return 'cyan';
    if (index === 2) return 'green';
    if (index === 3) return 'amber';
    return 'default';
  }

  detailToneClass(item: ProfileDetailItem): string {
    switch (item.tone) {
      case 'success':
        return 'status-chip--success';
      case 'warning':
        return 'status-chip--warning';
      default:
        return 'status-chip--neutral';
    }
  }

  saveProfile(value: ProfileSaveValue): void {
    this.isSaving = true;
    this.authService.updateProfile({
      nom: `${value.firstName.trim()} ${value.lastName.trim()}`.trim(),
      email: value.email.trim(),
      telephone: value.phone.trim(),
      poste: value.position.trim(),
      departement: value.roleSpecificField.trim()
    }).subscribe({
      next: () => {
        this.profileData = { ...this.profileData,
          firstName: value.firstName.trim(), lastName: value.lastName.trim(),
          email: value.email.trim(), phone: value.phone.trim(),
          position: value.position.trim(), roleSpecificField: value.roleSpecificField.trim()
        };
        this.feedbackMessage = 'Informations mises à jour avec succès.';
        this.feedbackTone = 'success';
        this.isSaving = false;
        this.syncProfileForm();
      },
      error: (err: { error?: { message?: string } }) => {
        this.feedbackMessage = err?.error?.message ?? 'Erreur lors de la sauvegarde.';
        this.feedbackTone = 'error';
        this.isSaving = false;
      }
    });
  }

  private buildProfileData(): Partial<ProfileData> {
    const session = this.authService.currentUser;
    const email = session?.email?.trim() || 'admin@smartassign.tn';
    const { firstName, lastName } = this.splitName(session?.nom?.trim() || 'Admin Principal');
    const extras = this.restoreLocalExtras(email);

    return {
      firstName,
      lastName,
      email,
      phone: session?.telephone || extras.phone || '+216 20 111 222',
      position: session?.poste || extras.position || 'Administrateur plateforme',
      roleSpecificField: session?.departement || extras.roleSpecificField || 'Direction des operations',
      stats: this.stats,
      permissions: this.permissions
    };
  }

  private syncProfileForm(): void {
    this.profileForm.setValue({
      firstName: this.currentProfile.firstName ?? '',
      lastName: this.currentProfile.lastName ?? '',
      email: this.currentProfile.email ?? '',
      phone: this.currentProfile.phone ?? '',
      position: this.currentProfile.position ?? '',
      roleSpecificField: this.currentProfile.roleSpecificField ?? ''
    });
  }

  private computeInitials(value: string, fallback: string): string {
    const initials = value
      .split(' ')
      .map((part) => part[0] ?? '')
      .join('')
      .slice(0, 2)
      .toUpperCase();

    return initials || fallback;
  }

  private splitName(value: string): { firstName: string; lastName: string } {
    const parts = value.split(/\s+/).filter(Boolean);

    if (!parts.length) {
      return { firstName: 'Admin', lastName: 'Principal' };
    }

    return {
      firstName: parts[0],
      lastName: parts.slice(1).join(' ') || 'Principal'
    };
  }

  private restoreLocalExtras(email: string): LocalProfileExtras {
    try {
      const raw = localStorage.getItem(this.getStorageKey(email));
      if (!raw) {
        return { phone: '', position: '', roleSpecificField: '' };
      }

      const parsed = JSON.parse(raw) as Partial<LocalProfileExtras>;
      return {
        phone: parsed.phone ?? '',
        position: parsed.position ?? '',
        roleSpecificField: parsed.roleSpecificField ?? ''
      };
    } catch {
      localStorage.removeItem(this.getStorageKey(email));
      return { phone: '', position: '', roleSpecificField: '' };
    }
  }

  private persistLocalExtras(email: string, extras: LocalProfileExtras): void {
    localStorage.setItem(this.getStorageKey(email), JSON.stringify(extras));
  }

  private getStorageKey(email: string): string {
    return `smartassign_admin_profile_${email.toLowerCase()}`;
  }
}