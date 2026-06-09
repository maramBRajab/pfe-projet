import { Component, OnDestroy, OnInit, ChangeDetectorRef, ElementRef, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { AdminCollaborateurService, Collaborateur } from '../../../../services/admin';
import { CompetenceService, Competence } from '../../../../services/manager/competence.service';
import { AuthService } from '../../../../services/auth';
import { NotificationBadgeService } from '../../../../services/admin/notification-badge.service';
import { AdminSidebarComponent } from '../../shared/admin-sidebar.component';
import { AdminTopbarComponent } from '../../shared/admin-topbar.component';
import { FormulaireCollaborateurComponent } from '../formulaire/formulaire.component';

import { KpiCardComponent } from '../../../../shared/kpi-card/kpi-card.component';
@Component({
  selector: 'app-liste-collaborateurs',
  standalone: true,
  imports: [CommonModule, FormsModule, KpiCardComponent, FormulaireCollaborateurComponent, AdminSidebarComponent, AdminTopbarComponent],
  templateUrl: './liste.component.html',
  styleUrl: './liste.component.scss'
})
export class ListeCollaborateursComponent implements OnInit, OnDestroy {
  private readonly allowedEmailDomains = new Set([
    'gmail.com',
    'outlook.com',
    'hotmail.com',
    'yahoo.com',
    'entreprise.com'
  ]);

  collaborateurs: Collaborateur[] = [];

  currentDate = new Date();
  today = new Date().toLocaleDateString('fr-FR', {
    weekday:'long', day:'numeric',
    month:'long', year:'numeric'
  });
  currentPage  = 1;
  pageSize     = 10;

  searchTerm         = '';
  roleFilter:         'all' | 'ADMIN' | 'MANAGER' | 'COLLAB' = 'all';
  disponibiliteFilter: 'all' | 'actif' | 'suspendu' | 'inactif' = 'all';
  experienceFilter:  'all' | 'junior' | 'confirmed' | 'senior' = 'all';

  isLoading        = false;
  errorMessage     = '';
  isCreateModalOpen = false;
  userMenuOpen = false;

  // ── Create form ─────────────────────────────────────────────
  createForm = {
    prenom: '',
    nom: '',
    email: '',
    telephone: '',
    role: 'COLLAB',
    departement: '',
    experienceAnnees: 0,
    competenceIds: [] as number[],
    disponible: true,
    statutCompte: 'ACTIF',
    disponibilite: 'DISPONIBLE'
  };
  createFormError = '';
  availableCompetences: Competence[] = [];

  // ── Modals ──────────────────────────────────────────────────
  viewedCollaborateur: Collaborateur | null = null;
  editedCollaborateurId: number | null = null;
  deleteTargetId: number | null = null;
  deleteTargetName = '';
  isDeleting = false;
  suspendTargetId: number | null = null;
  suspendTargetName: string = '';
  isSuspending: boolean = false;
  isResendingCredentials = false;
  resendSuccess = false;
  resendError = '';
  isResendingVerification = false;
  resendVerifSuccess = false;
  resendVerifError = '';
  isEditingEmail = false;
  editEmailValue = '';
  editEmailError = '';
  isSavingEmail = false;

  // ── CSV modal ───────────────────────────────────────────────
  showCsvModal = false;
  csvDragging  = false;
  toastMessage = '';
  private toastTimer?: ReturnType<typeof setTimeout>;
  // ── Created account modal ────────────────────────────────
  createdAccount: {
    name: string;
    email: string;
    telephone?: string;
    emailEnvoye: boolean;
    emailErreur?: string;
    verificationEmailEnvoye?: boolean;
    verificationEmailErreur?: string;
  } | null = null;
  adminPhoto: string | null = null;
  unreadCount = 0;
  private badgeSubscription?: Subscription;
  constructor(
    private adminCollaborateurService: AdminCollaborateurService,
    private competenceService: CompetenceService,
    private cdr: ChangeDetectorRef,
    private authService: AuthService,
    private router: Router,
    private elRef: ElementRef,
    private readonly notificationBadgeService: NotificationBadgeService
  ) {}

  ngOnInit(): void {
    this.adminPhoto = this.authService.currentUser?.photoUrl ?? null;
    this.unreadCount = this.notificationBadgeService.current();
    this.badgeSubscription = this.notificationBadgeService.count$.subscribe((count) => {
      this.unreadCount = count;
    });
    this.notificationBadgeService.load();
    this.loadCompetences();
    this.charger();
  }

  ngOnDestroy(): void {
    this.badgeSubscription?.unsubscribe();
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (!this.elRef.nativeElement.contains(event.target)) {
      this.userMenuOpen = false;
    }
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

  get filteredCollaborateurs(): Collaborateur[] {
    const s = this.searchTerm.trim().toLowerCase();

    return this.collaborateurs.filter(c => {
      const name  = `${c.prenom} ${c.nom}`.toLowerCase();
      const email = c.email.toLowerCase();
      const comps = (c.competences ?? [])
        .map(cp => this.readCompetenceName(cp).toLowerCase())
        .join(' ');

      const matchSearch = !s || name.includes(s) || email.includes(s) || comps.includes(s);

      const matchDispo =
        this.disponibiliteFilter === 'all' ||
        (this.disponibiliteFilter === 'actif'    &&  this.isCompteActif(c)) ||
        (this.disponibiliteFilter === 'suspendu' && !this.isCompteActif(c)) ||
        (this.disponibiliteFilter === 'inactif'  && !this.isCompteActif(c));

      const matchRole =
        this.roleFilter === 'all' ||
        this.normalizeRole(c.role) === this.roleFilter;

      const matchExp = this.matchesExperienceFilter(c.experienceAnnees);

      return matchSearch && matchDispo && matchRole && matchExp;
    });
  }

  get paginatedCollaborateurs(): Collaborateur[] {
    const start = (this.currentPage - 1) * this.pageSize;
    return this.filteredCollaborateurs.slice(start, start + this.pageSize);
  }

  get totalPages(): number {
    return Math.max(1, Math.ceil(this.filteredCollaborateurs.length / this.pageSize));
  }

  get pageNumbers(): number[] {
    return Array.from({ length: this.totalPages }, (_, i) => i + 1);
  }

  get disponiblesCount(): number {
    return this.collaborateurs.filter(c => c.disponible && this.isCompteActif(c) && this.isEmailVerified(c)).length;
  }

  get occupesCount(): number {
    return this.collaborateurs.filter(c => !c.disponible && this.isCompteActif(c) && this.isEmailVerified(c)).length;
  }

  get nonVerifiedCount(): number {
    return this.collaborateurs.filter(c => this.accountStatusKey(c) === 'EN_ATTENTE_VERIFICATION').length;
  }

  get reallyBlochedCount(): number {
    return this.collaborateurs.filter(c => this.accountStatusKey(c) === 'SUSPENDU').length;
  }

  get suspendusCount(): number {
    return this.nonVerifiedCount + this.reallyBlochedCount;
  }

  get totalCompetences(): number {
    return this.collaborateurs.reduce((t, c) => t + (c.competences?.length ?? 0), 0);
  }

  get moyenneExperience(): number {
    const validCollabs = this.collaborateurs.filter(c => 
      this.isCompteActif(c) && this.isEmailVerified(c) && c.experienceAnnees != null
    );
    if (!validCollabs.length) return 0;
    const total = validCollabs.reduce((s, c) => s + c.experienceAnnees, 0);
    return Number((total / validCollabs.length).toFixed(1));
  }

  // ── Actions ─────────────────────────────────────────────────────

  charger(): void {
    this.isLoading    = true;
    this.errorMessage = '';

    this.adminCollaborateurService.getAll().subscribe({
      next: data => {
        this.collaborateurs = data;
        this.isLoading      = false;
        this.cdr.detectChanges();
      },
      error: (err: HttpErrorResponse) => {
        if (err.status === 0) {
          this.errorMessage = 'Serveur indisponible. Vérifiez que le backend est démarré.';
        } else if (err.status === 401) {
          this.errorMessage = 'Session expirée. Veuillez vous reconnecter.';
        } else if (err.status === 403) {
          this.errorMessage = 'Accès refusé. Droits administrateur requis.';
        } else {
          this.errorMessage = `Erreur ${err.status} : impossible de charger les utilisateurs.`;
        }
        this.isLoading = false;
        this.cdr.detectChanges();
      }
    });
  }

  supprimer(id: number): void {
    const target = this.collaborateurs.find(c => c.id === id);
    this.deleteTargetId   = id;
    this.deleteTargetName = target ? `${target.prenom} ${target.nom}` : 'cet utilisateur';
  }

  closeDeleteModal(): void {
    if (this.isDeleting) return; // don't allow closing while a delete is in flight
    this.deleteTargetId   = null;
    this.deleteTargetName = '';
  }

  openSuspendModal(id: number, nom: string): void {
    this.suspendTargetId = id;
    this.suspendTargetName = nom;
  }

  closeSuspendModal(): void {
    if (this.isSuspending) return;
    this.suspendTargetId = null;
    this.suspendTargetName = '';
  }

  confirmerSuspension(): void {
    if (this.suspendTargetId == null || this.isSuspending) return;
    const id = this.suspendTargetId;
    this.isSuspending = true;
    this.adminCollaborateurService.updateStatut(id, 'SUSPENDU').subscribe({
      next: (updated) => {
        this.collaborateurs = this.collaborateurs.map(c => c.id === updated.id ? updated : c);
        this.isSuspending = false;
        this.closeSuspendModal();
        this.showToast('Compte suspendu avec succès');
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.errorMessage = err?.error?.message || 'La suspension du compte a échoué.';
        this.isSuspending = false;
        this.cdr.detectChanges();
      }
    });
  }

  activerCompte(id: number): void {
    this.adminCollaborateurService.updateStatut(id, 'ACTIF').subscribe({
      next: (updated) => {
        this.collaborateurs = this.collaborateurs.map(c => c.id === updated.id ? updated : c);
        this.showToast('Compte réactivé avec succès');
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.errorMessage = err?.error?.message || 'La réactivation du compte a échoué.';
        this.cdr.detectChanges();
      }
    });
  }

  confirmerSuppression(): void {
    if (!this.deleteTargetId || this.isDeleting) return;
    this.isDeleting = true;
    const id = this.deleteTargetId; // capture before async — closeDeleteModal() may null it out

    this.adminCollaborateurService.delete(id).subscribe({
      next: () => {
        this.collaborateurs = this.collaborateurs.filter(c => c.id !== id);
        this.showToast(`Utilisateur supprimé avec succès.`);
        this.isDeleting = false;
        this.closeDeleteModal();
        this.cdr.detectChanges();
      },
      error: (err) => {
        const msg = (err?.error?.message as string | undefined) || 'La suppression a échoué.';
        this.errorMessage = msg;
        this.isDeleting = false;
        this.closeDeleteModal();
        this.cdr.detectChanges();
      }
    });
  }

  openViewModal(c: Collaborateur): void {
    this.viewedCollaborateur = c;
    this.isResendingCredentials = false;
    this.resendSuccess = false;
    this.resendError = '';

    if (typeof c.id === 'number') {
      this.adminCollaborateurService.getById(c.id).subscribe({
        next: (details) => {
          this.viewedCollaborateur = {
            ...c,
            ...details,
            statutCompte: c.statutCompte ?? details.statutCompte
          };
          this.cdr.detectChanges();
        },
        error: () => {
          // Keep list data as fallback if detail fetch fails.
        }
      });
    }
  }

  closeViewModal(): void {
    this.viewedCollaborateur = null;
    this.isResendingCredentials = false;
    this.resendSuccess = false;
    this.resendError = '';
    this.isResendingVerification = false;
    this.resendVerifSuccess = false;
    this.resendVerifError = '';
    this.isEditingEmail = false;
    this.editEmailValue = '';
    this.editEmailError = '';
    this.isSavingEmail = false;
  }

  renvoyerIdentifiants(): void {
    if (!this.viewedCollaborateur?.email || this.isResendingCredentials) return;
    
    this.isResendingCredentials = true;
    this.resendError = '';
    this.resendSuccess = false;

    this.adminCollaborateurService.renvoyerIdentifiants(this.viewedCollaborateur.email).subscribe({
      next: () => {
        this.isResendingCredentials = false;
        this.resendSuccess = true;
        this.showToast('Identifiants renvoyés avec succès.');
        setTimeout(() => {
          this.resendSuccess = false;
          this.cdr.detectChanges();
        }, 4000);
      },
      error: (err) => {
        this.isResendingCredentials = false;
        const errorMsg = err?.error?.message || 'Erreur lors de l\'envoi des identifiants.';
        this.resendError = errorMsg;
        this.cdr.detectChanges();
        setTimeout(() => {
          this.resendError = '';
          this.cdr.detectChanges();
        }, 4000);
      }
    });
  }

  renvoyerVerificationEmail(): void {
    if (!this.viewedCollaborateur?.id || this.isResendingVerification) return;
    this.isResendingVerification = true;
    this.resendVerifError = '';
    this.resendVerifSuccess = false;
    this.adminCollaborateurService.renvoyerVerificationEmail(this.viewedCollaborateur.id).subscribe({
      next: () => {
        this.isResendingVerification = false;
        this.resendVerifSuccess = true;
        this.showToast('Email de vérification renvoyé.');
        setTimeout(() => { this.resendVerifSuccess = false; this.cdr.detectChanges(); }, 4000);
      },
      error: (err: any) => {
        this.isResendingVerification = false;
        this.resendVerifError = err?.error?.message || 'Impossible d\'envoyer l\'email de vérification.';
        this.cdr.detectChanges();
        setTimeout(() => { this.resendVerifError = ''; this.cdr.detectChanges(); }, 5000);
      }
    });
  }

  startEmailEdit(): void {
    if (!this.viewedCollaborateur) return;
    this.isEditingEmail = true;
    this.editEmailValue = this.viewedCollaborateur.email;
    this.editEmailError = '';
  }

  cancelEmailEdit(): void {
    this.isEditingEmail = false;
    this.editEmailValue = '';
    this.editEmailError = '';
  }

  saveEmailEdit(): void {
    if (!this.viewedCollaborateur?.id || this.isSavingEmail) return;
    const newEmail = this.editEmailValue.trim();
    if (!this.isValidEmail(newEmail)) {
      this.editEmailError = 'Email invalide.';
      return;
    }
    this.isSavingEmail = true;
    this.editEmailError = '';
    const payload = {
      nom: this.viewedCollaborateur.nom,
      prenom: this.viewedCollaborateur.prenom,
      email: newEmail,
      telephone: this.viewedCollaborateur.telephone,
      role: this.viewedCollaborateur.role,
      departement: this.viewedCollaborateur.departement,
      experienceAnnees: this.viewedCollaborateur.experienceAnnees,
      disponible: this.viewedCollaborateur.disponible,
      competenceIds: (this.viewedCollaborateur.competences ?? []).map((c: any) => c.id).filter((id: any) => typeof id === 'number')
    };
    this.adminCollaborateurService.update(this.viewedCollaborateur.id, payload).subscribe({
      next: (updated) => {
        this.isSavingEmail = false;
        this.isEditingEmail = false;
        this.viewedCollaborateur = { ...this.viewedCollaborateur!, ...updated };
        this.collaborateurs = this.collaborateurs.map(c => c.id === updated.id ? updated : c);
        this.showToast('Adresse email mise à jour.');
        this.cdr.detectChanges();
      },
      error: (err: any) => {
        this.isSavingEmail = false;
        this.editEmailError = err?.error?.message || 'Impossible de mettre à jour l\'email.';
        this.cdr.detectChanges();
      }
    });
  }

  /** Close view modal then open edit modal — captures ID before nulling viewedCollaborateur */
  editFromViewModal(): void {
    const id = this.viewedCollaborateur?.id;
    if (id == null) return;
    this.viewedCollaborateur = null;
    this.editedCollaborateurId = id;
  }

  openEditModal(id: number): void {
    this.editedCollaborateurId = id;
  }

  closeEditModal(): void {
    this.editedCollaborateurId = null;
  }

  onEditSaved(): void {
    const id = this.editedCollaborateurId; // capture before closing
    this.closeEditModal();
    this.showToast('Utilisateur mis à jour avec succès.');
    // Refresh only the modified row — avoids hiding the whole table via charger()
    if (id != null) {
      this.adminCollaborateurService.getById(id).subscribe({
        next: updated => {
          this.collaborateurs = this.collaborateurs.map(c => c.id === updated.id ? updated : c);
          this.cdr.detectChanges();
        },
        error: () => this.charger() // fallback to full reload if targeted fetch fails
      });
    } else {
      this.charger();
    }
  }

  private showToast(msg: string): void {
    if (this.toastTimer) clearTimeout(this.toastTimer);
    this.toastMessage = msg;
    this.toastTimer = setTimeout(() => {
      this.toastMessage = '';
      this.cdr.detectChanges();
    }, 3000);
  }

  closeCreatedAccountModal(): void {
    this.createdAccount = null;
  }

  toggleDisponibilite(collaborateur: Collaborateur): void {
    if (typeof collaborateur.id !== 'number') return;

    this.adminCollaborateurService.toggleDisponibilite(collaborateur.id).subscribe({
      next: updated => {
        this.collaborateurs = this.collaborateurs.map(item =>
          item.id === updated.id ? updated : item
        );
        this.cdr.detectChanges();
      },
      error: () => {
        this.errorMessage = 'La mise à jour de la disponibilité a échoué.';
        this.cdr.detectChanges();
      }
    });
  }

  clearFilters(): void {
    this.searchTerm          = '';
    this.roleFilter          = 'all';
    this.disponibiliteFilter = 'all';
    this.experienceFilter    = 'all';
    this.currentPage         = 1;
  }

  goToPage(page: number): void {
    if (page >= 1 && page <= this.totalPages) {
      this.currentPage = page;
    }
  }

  min(a: number, b: number): number { return Math.min(a, b); }

  private isValidEmail(email: string): boolean {
    const normalized = email.trim().toLowerCase();
    const match = normalized.match(/^([a-z0-9._%+-]+)@([a-z0-9.-]+\.[a-z]{2,})$/i);
    if (!match) {
      return false;
    }

    const domain = match[2];
    return this.allowedEmailDomains.has(domain);
  }

  private isValidPhone(phone: string): boolean {
    return /^\d{8}$/.test(phone);
  }

  get createEmailInvalid(): boolean {
    const value = this.createForm.email.trim();
    return value.length > 0 && !this.isValidEmail(value);
  }

  get createShowExperience(): boolean {
    return this.normalizeRole(this.createForm.role) !== 'ADMIN';
  }

  get createShowDisponibilite(): boolean {
    return this.normalizeRole(this.createForm.role) === 'COLLAB';
  }

  get createShowCompetences(): boolean {
    return this.normalizeRole(this.createForm.role) === 'COLLAB';
  }

  onCreateRoleChange(): void {
    if (!this.createShowExperience) {
      this.createForm.experienceAnnees = 0;
    }

    if (!this.createShowDisponibilite) {
      this.createForm.disponible = true;
    }

    if (!this.createShowCompetences) {
      this.createForm.competenceIds = [];
    }
  }

  private loadCompetences(): void {
    this.competenceService.getAll().subscribe({
      next: (competences) => {
        this.availableCompetences = competences;
        this.cdr.detectChanges();
      },
      error: () => {
        this.availableCompetences = [];
      }
    });
  }

  isCreateCompetenceSelected(id: number | undefined): boolean {
    return typeof id === 'number' && this.createForm.competenceIds.includes(id);
  }

  toggleCreateCompetence(id: number | undefined): void {
    if (typeof id !== 'number') {
      return;
    }

    this.createForm.competenceIds = this.isCreateCompetenceSelected(id)
      ? this.createForm.competenceIds.filter((value) => value !== id)
      : [...this.createForm.competenceIds, id];
  }

  openCreateModal(): void {
    this.errorMessage     = '';
    this.createFormError  = '';
    this.createForm       = {
      prenom: '',
      nom: '',
      email: '',
      telephone: '',
      role: 'COLLAB',
      departement: '',
      experienceAnnees: 0,
      competenceIds: [],
      disponible: true,
      statutCompte: 'ACTIF',
      disponibilite: 'DISPONIBLE'
    };
    this.isCreateModalOpen = true;
  }

  closeCreateModal(): void {
    this.isCreateModalOpen = false;
    this.createFormError   = '';
  }

  submitCreateForm(): void {
    const { prenom, nom, email, role, telephone, departement, experienceAnnees, competenceIds, disponible, statutCompte } = this.createForm;
    if (!prenom.trim() || !nom.trim() || !email.trim()) {
      this.createFormError = 'Veuillez remplir tous les champs obligatoires.';
      return;
    }
    if (!telephone.trim()) {
      this.createFormError = 'Le téléphone est obligatoire.';
      return;
    }
    if (!role.trim()) {
      this.createFormError = 'Veuillez sélectionner un rôle.';
      return;
    }
    if (!this.isValidEmail(email.trim())) {
      this.createFormError = 'Veuillez saisir une adresse email valide.';
      return;
    }
    if (!this.isValidPhone(telephone.trim())) {
      this.createFormError = 'Le numéro de téléphone doit contenir exactement 8 chiffres.';
      return;
    }
    if (this.createShowExperience && experienceAnnees < 0) {
      this.createFormError = 'L\'expérience doit être positive.';
      return;
    }
    this.createFormError = '';
    const payload = {
      prenom: prenom.trim(),
      nom: nom.trim(),
      email: email.trim(),
      telephone: telephone.trim(),
      role,
      departement: departement.trim() || undefined,
      experienceAnnees: this.createShowExperience ? experienceAnnees : 0,
      disponible: this.createShowDisponibilite ? disponible : true,
      competenceIds: this.createShowCompetences ? competenceIds : []
    };
    this.adminCollaborateurService.create(payload).subscribe({
      next: (created) => {
        const finalizeCreation = (finalCreated: Collaborateur) => {
          this.closeCreateModal();
          this.createdAccount = {
            name: `${prenom.trim()} ${nom.trim()}`,
            email: finalCreated.email,
            telephone: finalCreated.telephone,
            emailEnvoye: finalCreated.emailEnvoye === true,
            emailErreur: finalCreated.emailErreur,
            verificationEmailEnvoye: finalCreated.verificationEmailEnvoye === true,
            verificationEmailErreur: finalCreated.verificationEmailErreur
          };
          this.charger();
        };

        if (typeof created.id === 'number' && statutCompte === 'SUSPENDU') {
          this.adminCollaborateurService.updateStatut(created.id, 'SUSPENDU').subscribe({
            next: (updated) => finalizeCreation(updated),
            error: () => finalizeCreation(created)
          });
          return;
        }

        finalizeCreation(created);
      },
      error: (err: HttpErrorResponse) => {
        const backendMessage = err.error?.message as string | undefined;
        const validationErrors = err.error?.validationErrors as Record<string, string> | undefined;
        const firstValidationMessage = validationErrors ? Object.values(validationErrors)[0] : undefined;
        this.createFormError = backendMessage
          ?? firstValidationMessage
          ?? (err.status === 409
            ? 'Cette adresse email est déjà utilisée.'
            : 'Erreur lors de la création.');
      }
    });
  }

  // ── Template helpers ────────────────────────────────────────────

  trackByCollaborateur(_: number, c: Collaborateur) {
    return c.id ?? c.email;
  }

  /** Compteur dynamique d'utilisateurs par rôle (utilisé par les onglets). */
  countByRole(role: 'ADMIN' | 'MANAGER' | 'COLLAB'): number {
    return this.collaborateurs.filter(c => this.normalizeRole(c.role) === role).length;
  }

  initiales(nom: string, prenom: string): string {
    return `${prenom?.[0] ?? ''}${nom?.[0] ?? ''}`.toUpperCase();
  }

  /** Couleur de l'avatar selon le rôle */
  avatarClass(role: string): string {
    switch (this.normalizeRole(role)) {
      case 'ADMIN':   return 'avatar-amber';
      case 'MANAGER': return 'avatar-cyan';
      default:        return '';            // bleu par défaut via CSS
    }
  }

  roleBadgeClass(role: string): string {
    switch (this.normalizeRole(role)) {
      case 'ADMIN':   return 'badge-violet';
      case 'MANAGER': return 'badge-blue';
      default:        return 'badge-slate';
    }
  }

  roleLabel(role: string): string {
    switch (this.normalizeRole(role)) {
      case 'ADMIN':   return 'Admin';
      case 'MANAGER': return 'Manager';
      default:        return 'Collaborateur';
    }
  }

  rolePermissions(role: string): string[] {
    switch (this.normalizeRole(role)) {
      case 'ADMIN':
        return [
          'Gestion des utilisateurs',
          'Gestion des projets',
          'Gestion des affectations',
          'Accès complet'
        ];
      case 'MANAGER':
        return [
          'Gestion de son équipe',
          'Gestion des tâches',
          'Consultation des collaborateurs'
        ];
      default:
        return [
          'Consultation de ses tâches',
          'Mise à jour de sa disponibilité'
        ];
    }
  }

  isAdminRole(role: string): boolean {
    return this.normalizeRole(role) === 'ADMIN';
  }

  isManagerRole(role: string): boolean {
    return this.normalizeRole(role) === 'MANAGER';
  }

  isCollabRole(role: string): boolean {
    return this.normalizeRole(role) === 'COLLAB';
  }

  isCompteActif(c: Collaborateur): boolean {
    return this.accountStatusKey(c) === 'ACTIF';
  }

  isCompteSuspendu(c: Collaborateur): boolean {
    return this.accountStatusKey(c) === 'SUSPENDU';
  }

  accountStatusLabel(c: Collaborateur): string {
    const key = this.accountStatusKey(c);
    if (key === 'EN_ATTENTE_VERIFICATION') {
      return 'En attente de vérification';
    }
    return key === 'ACTIF' ? 'Actif' : 'Suspendu';
  }

  isEmailVerified(c: Collaborateur): boolean {
    return c.emailVerifie === true || c.statutVerificationEmail === 'VERIFIE';
  }

  emailVerificationLabel(c: Collaborateur): string {
    return this.isEmailVerified(c) ? 'Email vérifié' : 'Email non vérifié';
  }

  verificationDateLabel(c: Collaborateur): string {
    if (!this.isEmailVerified(c) || !c.emailVerifieLe) {
      return 'Non vérifié';
    }

    const date = new Date(c.emailVerifieLe);
    if (Number.isNaN(date.getTime())) {
      return 'Date indisponible';
    }

    return date.toLocaleString('fr-FR');
  }

  competenceLabels(collaborateur: Collaborateur): string[] {
    return (collaborateur.competences ?? [])
      .map(c => this.readCompetenceName(c))
      .filter(label => !!label);
  }

  departmentLabel(collaborateur: Collaborateur): string {
    return (collaborateur.departement ?? '').trim() || '—';
  }

  // ── Private ─────────────────────────────────────────────────────

  private matchesExperienceFilter(exp: number): boolean {
    switch (this.experienceFilter) {
      case 'junior':    return exp < 3;
      case 'confirmed': return exp >= 3 && exp < 7;
      case 'senior':    return exp >= 7;
      default:          return true;
    }
  }

  private normalizeRole(role: string | undefined): 'ADMIN' | 'MANAGER' | 'COLLAB' {
    const r = (role ?? 'COLLAB').toUpperCase();
    if (r.includes('ADMIN') || r.includes('ADMINISTRATEUR')) return 'ADMIN';
    if (r.includes('MANAGER') || r.includes('CHEF')) return 'MANAGER';
    if (r.includes('COLLABORATEUR'))                 return 'COLLAB';
    return 'COLLAB';
  }

  private accountStatusKey(c: Collaborateur): 'ACTIF' | 'SUSPENDU' | 'EN_ATTENTE_VERIFICATION' {
    const status = c.statutCompte;
    if (status === 'ACTIF' || status === 'SUSPENDU' || status === 'EN_ATTENTE_VERIFICATION') {
      return status;
    }
    return this.isEmailVerified(c) ? 'ACTIF' : 'EN_ATTENTE_VERIFICATION';
  }

  private readCompetenceName(c: unknown): string {
    if (typeof c === 'string') return c;
    if (typeof c === 'object' && c && 'nom' in c) {
      const { nom } = c as any;
      return typeof nom === 'string' ? nom : '';
    }
    return '';
  }

  openCsvModal():  void { this.showCsvModal = true; }
  closeCsvModal(): void { this.showCsvModal = false; this.csvDragging = false; }

  onCsvDragOver(e: DragEvent): void  { e.preventDefault(); this.csvDragging = true; }
  onCsvDragLeave(): void              { this.csvDragging = false; }
  onCsvDrop(e: DragEvent): void {
    e.preventDefault();
    this.csvDragging = false;
    const file = e.dataTransfer?.files?.[0];
    if (file) { this.handleCsvFile(file); }
  }
  onCsvFileChange(e: Event): void {
    const input = e.target as HTMLInputElement;
    if (input.files?.[0]) { this.handleCsvFile(input.files[0]); input.value = ''; }
  }
  private handleCsvFile(file: File): void {
    const reader = new FileReader();
    reader.onload = () => { this.charger(); };
    reader.readAsText(file, 'utf-8');
    this.closeCsvModal();
  }

  importerCSV(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (!input.files?.length) return;
    const file = input.files[0];
    const reader = new FileReader();
    reader.onload = () => {
      // CSV imported — refresh list to reflect any server-side processing
      this.charger();
    };
    reader.readAsText(file, 'utf-8');
    // Reset so the same file can be re-selected
    input.value = '';
  }

  exporterCSV(): void {
    const escape = (val: string) =>
      val.includes(',') || val.includes('"') || val.includes('\n')
        ? `"${val.replace(/"/g, '""')}"`
        : val;

    const header = 'Nom,Email,Rôle,Expérience (ans),Disponibilité';
    const rows = this.filteredCollaborateurs.map(c =>
      [
        escape(`${c.prenom} ${c.nom}`),
        escape(c.email),
        escape(this.roleLabel(c.role)),
        String(c.experienceAnnees),
        c.disponible ? 'Disponible' : 'Occupé'
      ].join(',')
    );

    const csv = [header, ...rows].join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = 'utilisateurs.csv';
    a.click();
    URL.revokeObjectURL(url);
    this.showToast('Export CSV téléchargé.');
  }

  exportExcel(): void {
    this.exporterCSV();
  }

  exportPdf(): void {
    const win = window.open('', '_blank', 'width=1000,height=700');
    if (!win) return;
    const rows = this.filteredCollaborateurs.map(c => `
      <tr>
        <td>${c.prenom} ${c.nom}</td>
        <td>${c.email}</td>
        <td>${this.roleLabel(c.role)}</td>
        <td>${c.experienceAnnees} an(s)</td>
        <td><span class="badge badge--${c.disponible ? 'ok' : 'busy'}">${c.disponible ? 'Disponible' : 'Occupé'}</span></td>
      </tr>`).join('');
    win.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8">
      <title>Utilisateurs — SmartAssign</title>
      <style>
        body { font-family: Inter, sans-serif; font-size: 12px; color: #1e293b; padding: 24px; }
        h1   { font-size: 18px; margin-bottom: 4px; }
        p    { color: #64748b; margin-bottom: 16px; font-size: 12px; }
        table{ width: 100%; border-collapse: collapse; }
        th   { background: #f5f7fb; text-align: left; padding: 7px 10px; font-size: 10px; text-transform: uppercase; letter-spacing: .8px; border-bottom: 2px solid #e6ebf2; }
        td   { padding: 7px 10px; border-bottom: 1px solid #e6ebf2; }
        .badge { padding: 2px 8px; border-radius: 4px; font-size: 10px; font-weight: 600; }
        .badge--ok   { background: #ecfdf5; color: #059669; }
        .badge--busy { background: #fef3c7; color: #d97706; }
      </style></head><body>
      <h1>Liste des utilisateurs — SmartAssign</h1>
      <p>Généré le ${new Date().toLocaleDateString('fr-FR')} · ${this.filteredCollaborateurs.length} utilisateur(s)</p>
      <table><thead><tr><th>Nom</th><th>Email</th><th>Rôle</th><th>Expérience</th><th>Disponibilité</th></tr></thead>
      <tbody>${rows}</tbody></table></body></html>`);
    win.document.close();
    win.focus();
    win.print();
  }
}
