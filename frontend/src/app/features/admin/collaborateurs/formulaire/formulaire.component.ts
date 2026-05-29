import { ChangeDetectorRef, Component, EventEmitter, Input, OnChanges, OnInit, Output, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink, ActivatedRoute, Router } from '@angular/router';
import {
  AdminCollaborateurService,
  Collaborateur,
  CollaborateurRequest,
} from '../../../../services/admin';
import { AdminTopbarComponent } from '../../shared/admin-topbar.component';
import { AdminSidebarComponent } from '../../shared/admin-sidebar.component';
import { CompetenceService, Competence } from '../../../../services/manager/competence.service';

@Component({
  selector: 'app-formulaire-collaborateur',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, AdminTopbarComponent, AdminSidebarComponent],
  templateUrl: './formulaire.component.html',
  styleUrl: './formulaire.component.scss'
})
export class FormulaireCollaborateurComponent implements OnInit, OnChanges {
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
    nom: '', prenom: '', email: '', role: 'COLLAB',
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
      || !this.collaborateur.role.trim()
        || this.collaborateur.experienceAnnees < 0;
  }

  get generatedEmailPreview(): string {
    const prenom = this.collaborateur.prenom.trim();
    const nom = this.collaborateur.nom.trim();

    if (!prenom && !nom) {
      return this.collaborateur.email || 'prenom.nom@smartassign.tn';
    }

    const localPart = [prenom, nom]
      .map((value) => this.slugify(value))
      .filter(Boolean)
      .join('.');

    return `${localPart || 'utilisateur'}@smartassign.tn`;
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

  sauvegarder(): void {
    if (this.formInvalid || this.isSaving) return;
    this.isSaving = true; this.errorMessage = '';

    this.syncSelectedCompetences();

    const payload: CollaborateurRequest = {
      nom:    this.collaborateur.nom.trim(),
      prenom: this.collaborateur.prenom.trim(),
      email:  this.generatedEmailPreview,
      role: this.normalizeRole(this.collaborateur.role),
      experienceAnnees: this.collaborateur.experienceAnnees,
      disponible: this.collaborateur.disponible,
      competenceIds: this.selectedCompetenceIds,
    };

    const req$ = this.isEditMode && this.id
      ? this.adminCollaborateurService.update(this.id, payload)
      : this.adminCollaborateurService.create(payload);

    req$.subscribe({
      next:  (response) => {
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

  private slugify(value: string): string {
    return value
      .trim()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '.')
      .replace(/\.+/g, '.')
      .replace(/^\.|\.$/g, '');
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
      nom: '', prenom: '', email: '', role: 'COLLAB',
      experienceAnnees: 0, disponible: true, competences: []
    };
    this.syncSelectedCompetences();
  }
}