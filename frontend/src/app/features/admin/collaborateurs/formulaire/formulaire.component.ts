import { ChangeDetectorRef, Component, EventEmitter, Input, OnChanges, OnInit, Output, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink, ActivatedRoute, Router } from '@angular/router';
import {
  AdminCollaborateurService,
  Collaborateur,
  CollaborateurRequest,
} from '../../../../services/admin';
import { AdminSidebarComponent } from '../../shared/admin-sidebar.component';
import { CompetenceService, Competence } from '../../../../services/manager/competence.service';

import { KpiCardComponent } from '../../../../shared/kpi-card/kpi-card.component';
@Component({
  selector: 'app-formulaire-collaborateur',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, KpiCardComponent, AdminSidebarComponent],
  templateUrl: './formulaire.component.html',
  styleUrl: './formulaire.component.scss'
})
export class FormulaireCollaborateurComponent implements OnInit, OnChanges {
  private readonly allowedEmailDomains = new Set([
    'gmail.com',
    'outlook.com',
    'hotmail.com',
    'yahoo.com',
    'entreprise.com'
  ]);

  @Input() embedded = false;
  @Output() cancel = new EventEmitter<void>();
  @Output() created = new EventEmitter<void>();

  @Input() set editId(value: number | null) {
    if (value != null && value > 0) {
      this.id = value;
      this.isEditMode = true;
      this.chargerCollaborateur(value);
    }
  }

  isEditMode   = false;
  id: number | null = null;
  isLoading    = false;
  isSaving     = false;
  loadingCompetences = false;
  competenceSearch = '';
  errorMessage = '';
  copyMessage = '';
  telephone = '';
  departement = '';
  statutCompte: 'ACTIF' | 'SUSPENDU' = 'ACTIF';
  originalStatutCompte: 'ACTIF' | 'SUSPENDU' = 'ACTIF';
  competencesTexte = '';
  availableCompetences: Competence[] = [];
  selectedCompetenceIds: number[] = [];
  createdCredentials: { fullName: string; email: string; password: string; role: string } | null = null;

  get filteredCompetences(): Competence[] {
    const q = this.competenceSearch.trim().toLowerCase();
    if (!q) return this.availableCompetences;
    return this.availableCompetences.filter(c => c.nom.toLowerCase().includes(q));
  }

  collaborateur: Collaborateur = {
    nom: '', prenom: '', email: '', role: 'COLLAB', departement: '',
    experienceAnnees: 0, disponible: true, competences: []
  };

  readonly Math = Math;

  constructor(
    private adminCollaborateurService: AdminCollaborateurService,
    private competenceService: CompetenceService,
    private route: ActivatedRoute,
    private router: Router,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['embedded']?.currentValue && !this.isEditMode) {
      this.resetCreationState();
    }
  }

  ngOnInit(): void {
    this.loadCompetences();

    const routeId = Number(this.route.snapshot.paramMap.get('id'));
    if (!Number.isNaN(routeId) && routeId > 0) {
      this.id = routeId; this.isEditMode = true;
      this.chargerCollaborateur(routeId);
    }
  }

  get formInvalid(): boolean {
    return !this.collaborateur.prenom.trim()
      || !this.collaborateur.nom.trim()
      || !this.collaborateur.email.trim()
      || this.emailInvalid
      || !this.telephone.trim()
      || !this.isValidPhone(this.telephone.trim())
      || !this.collaborateur.role.trim()
      || (this.showExperience && this.collaborateur.experienceAnnees < 0);
  }

  get showExperience(): boolean {
    return this.normalizeRole(this.collaborateur.role) !== 'ADMIN';
  }

  get showDisponibilite(): boolean {
    return this.normalizeRole(this.collaborateur.role) === 'COLLAB';
  }

  get showCompetences(): boolean {
    return this.normalizeRole(this.collaborateur.role) === 'COLLAB';
  }

  get emailInvalid(): boolean {
    const email = this.collaborateur.email.trim();
    return email.length > 0 && !this.isValidEmail(email);
  }

  get generatedEmailPreview(): string {
    return this.collaborateur.email?.trim() || 'Email personnel (ex: m.ali@gmail.com)';
  }

  get fullNamePreview(): string {
    const n = `${this.collaborateur.prenom} ${this.collaborateur.nom}`.trim();
    return n || 'Nouveau collaborateur';
  }

  get initialsPreview(): string {
    return `${this.collaborateur.prenom?.[0]??''}${this.collaborateur.nom?.[0]??''}`.toUpperCase() || 'NC';
  }

  get experienceLabel(): string {
    const e = this.collaborateur.experienceAnnees;
    if (e >= 7) return 'Senior';
    if (e >= 3) return 'Confirmé';
    return 'Junior';
  }

  get formStateLabel(): string {
    return this.formInvalid ? 'Incomplet' : 'Prêt à enregistrer';
  }

  get title(): string {
    return this.isEditMode ? 'Modifier un compte utilisateur' : 'Créer un compte utilisateur';
  }

  get descriptionText(): string {
    return this.embedded
      ? 'Configurez les informations du compte, le rôle et la disponibilité d’un utilisateur directement dans cette fenêtre.'
      : 'Configurez les informations du compte, le rôle et la disponibilité d’un utilisateur sans modifier la logique de fonctionnement de la plateforme.';
  }

  get disponibiliteLabel(): string {
    return this.collaborateur.disponible ? 'Immédiate' : 'Non disponible';
  }

  get roleLabel(): string {
    switch (this.normalizeRole(this.collaborateur.role)) {
      case 'ADMIN':
        return 'Admin';
      case 'MANAGER':
        return 'Manager';
      default:
        return 'Collaborateur';
    }
  }

  get competencesPreview(): string {
    if (!this.selectedCompetenceIds.length) {
      return 'Aucune compétence sélectionnée';
    }

    return `${this.selectedCompetenceIds.length} compétence(s) sélectionnée(s)`;
  }

  isCompetenceSelected(id: number | undefined): boolean {
    return typeof id === 'number' && this.selectedCompetenceIds.includes(id);
  }

  toggleCompetence(id: number | undefined): void {
    if (typeof id !== 'number') {
      return;
    }

    this.selectedCompetenceIds = this.isCompetenceSelected(id)
      ? this.selectedCompetenceIds.filter((value) => value !== id)
      : [...this.selectedCompetenceIds, id];
  }

  onRoleChanged(): void {
    if (!this.showExperience) {
      this.collaborateur.experienceAnnees = 0;
    }

    if (!this.showDisponibilite) {
      this.collaborateur.disponible = true;
    }

    if (!this.showCompetences) {
      this.selectedCompetenceIds = [];
      this.syncSelectedCompetences();
    }
  }

  sauvegarder(): void {
    if (this.formInvalid || this.isSaving) return;
    this.isSaving = true; this.errorMessage = '';
    const requestedStatut = this.statutCompte;
    const previousStatut = this.originalStatutCompte;

    this.syncSelectedCompetences();

    const payload: CollaborateurRequest = {
      nom:    this.collaborateur.nom.trim(),
      prenom: this.collaborateur.prenom.trim(),
      email:  this.collaborateur.email.trim(),
      telephone: this.telephone.trim() || undefined,
      role: this.normalizeRole(this.collaborateur.role),
      departement: this.departement.trim() || undefined,
      experienceAnnees: this.showExperience ? this.collaborateur.experienceAnnees : 0,
      disponible: this.showDisponibilite ? this.collaborateur.disponible : true,
      competenceIds: this.showCompetences ? this.selectedCompetenceIds : [],
    };

    const req$ = this.isEditMode && this.id
      ? this.adminCollaborateurService.update(this.id, payload)
      : this.adminCollaborateurService.create(payload);

    req$.subscribe({
      next:  (response) => {
        const finalizeAfterStatut = () => {
          this.isSaving = false;

          if (this.isEditMode) {
            if (this.embedded) {
              this.created.emit();
              return;
            }

            this.router.navigate(['/admin/collaborateurs']);
            return;
          }

          this.collaborateur = {
            ...response,
            role: this.normalizeRole(response.role)
          };
          this.telephone = response.telephone ?? '';
          this.departement = response.departement ?? '';
          this.statutCompte = (response.statutCompte === 'SUSPENDU' ? 'SUSPENDU' : 'ACTIF');

          this.createdCredentials = response.motDePasseGenere
            ? {
                fullName: `${response.prenom} ${response.nom}`.trim(),
                email: response.email,
                password: response.motDePasseGenere,
                role: this.roleLabel
              }
            : null;

          if (this.embedded) {
            this.created.emit();
          }

          this.cdr.detectChanges();
        };

        if (this.isEditMode && this.id && requestedStatut !== previousStatut) {
          this.adminCollaborateurService.updateStatut(this.id, requestedStatut).subscribe({
            next: (updated) => {
              this.statutCompte = (updated.statutCompte === 'SUSPENDU' ? 'SUSPENDU' : 'ACTIF');
              this.originalStatutCompte = this.statutCompte;
              finalizeAfterStatut();
            },
            error: () => {
              this.errorMessage = 'La mise à jour du statut a échoué.';
              this.isSaving = false;
              this.cdr.detectChanges();
            }
          });
          return;
        }

        this.statutCompte = (response.statutCompte === 'SUSPENDU' ? 'SUSPENDU' : 'ACTIF');
        finalizeAfterStatut();
      },
      error: (error) => {
        this.errorMessage = this.extractErrorMessage(error, 'Impossible d\'enregistrer le collaborateur.');
        this.isSaving = false;
        this.cdr.detectChanges();
      }
    });
  }

  private loadCompetences(): void {
    this.loadingCompetences = true;
    this.competenceService.getAll().subscribe({
      next: (competences) => {
        this.availableCompetences = competences;
        this.loadingCompetences = false;
        this.syncSelectedCompetences();
        this.cdr.detectChanges();
      },
      error: () => {
        this.loadingCompetences = false;
        this.errorMessage = 'Impossible de charger les compétences.';
        this.cdr.detectChanges();
      }
    });
  }

  private chargerCollaborateur(id: number): void {
    this.isLoading = true; this.errorMessage = '';
    this.adminCollaborateurService.getById(id).subscribe({
      next:  data => {
        this.collaborateur = {
          ...data,
          role: this.normalizeRole(data.role)
        };
        this.telephone = data.telephone ?? '';
        this.departement = data.departement ?? '';
        this.statutCompte = (data.statutCompte === 'SUSPENDU' ? 'SUSPENDU' : 'ACTIF');
        this.originalStatutCompte = this.statutCompte;
        this.selectedCompetenceIds = (data.competences ?? [])
          .map((competence: Competence) => competence.id)
          .filter((id): id is number => typeof id === 'number');
        this.syncSelectedCompetences();
        this.isLoading = false;
        this.cdr.detectChanges();
      },
      error: ()   => {
        this.errorMessage = 'Impossible de charger ce collaborateur.';
        this.isLoading = false;
        this.cdr.detectChanges();
      }
    });
  }

  private syncSelectedCompetences(): void {
    const selected = this.availableCompetences.filter((competence) =>
      typeof competence.id === 'number' && this.selectedCompetenceIds.includes(competence.id)
    );

    this.collaborateur.competences = selected;
  }

  private extractErrorMessage(error: unknown, fallback: string): string {
    const apiError = error as {
      error?: { message?: string; validationErrors?: Record<string, string> };
    };

    const validationErrors = apiError?.error?.validationErrors;
    if (validationErrors) {
      const firstValidationMessage = Object.values(validationErrors)[0];
      if (firstValidationMessage) {
        return firstValidationMessage;
      }
    }

    return apiError?.error?.message ?? fallback;
  }

  async copierMotDePasse(): Promise<void> {
    if (!this.createdCredentials) {
      return;
    }

    const content = [
      `Nom: ${this.createdCredentials.fullName}`,
      `Email: ${this.createdCredentials.email}`,
      `Role: ${this.createdCredentials.role}`,
      `Mot de passe: ${this.createdCredentials.password}`
    ].join('\n');

    try {
      await navigator.clipboard.writeText(content);
      this.copyMessage = 'Identifiants copiés dans le presse-papiers.';
    } catch {
      this.copyMessage = 'Copie automatique impossible sur ce navigateur.';
    }
  }

  creerUnAutreCompte(): void {
    this.resetCreationState();
    this.cdr.detectChanges();
  }

  handleCancel(): void {
    if (this.embedded) {
      this.cancel.emit();
      this.resetCreationState();
      return;
    }

    this.router.navigate(['/admin/collaborateurs']);
  }

  private normalizeRole(role: string | undefined): 'ADMIN' | 'MANAGER' | 'COLLAB' {
    const normalizedRole = (role ?? 'COLLAB').toUpperCase();

    if (normalizedRole.includes('ADMIN')) {
      return 'ADMIN';
    }

    if (normalizedRole.includes('MANAGER') || normalizedRole.includes('CHEF')) {
      return 'MANAGER';
    }

    return 'COLLAB';
  }

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

  private resetCreationState(): void {
    if (this.isEditMode) {
      return;
    }

    this.createdCredentials = null;
    this.copyMessage = '';
    this.errorMessage = '';
    this.isSaving = false;
    this.selectedCompetenceIds = [];
    this.collaborateur = {
      nom: '', prenom: '', email: '', role: 'COLLAB', departement: '',
      experienceAnnees: 0, disponible: true, competences: []
    };
    this.telephone = '';
    this.departement = '';
    this.statutCompte = 'ACTIF';
    this.originalStatutCompte = 'ACTIF';
    this.syncSelectedCompetences();
  }
}