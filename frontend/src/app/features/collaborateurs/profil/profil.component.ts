import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { catchError, forkJoin, map, of, switchMap } from 'rxjs';

import { Affectation, AffectationService, Collaborateur, CollaborateurRequest, CollaborateurService, Competence, CompetenceService } from '../../../services/collaborateur';
import { AuthService } from '../../../services/auth';
import { CollaborateurShellComponent } from '../shared/collaborateur-shell.component';
import { CollabTopbarComponent } from '../shared/collab-topbar.component';

@Component({
  selector: 'app-collaborateur-profil',
  standalone: true,
  imports: [CommonModule, FormsModule, CollaborateurShellComponent, CollabTopbarComponent],
  templateUrl: './profil.component.html',
  styleUrl: './profil.component.scss'
})
export class CollaborateurProfilComponent implements OnInit {
  isLoading = true;
  isSaving = false;
  isUpdatingDisponibilite = false;
  loadError = '';
  errorMessage = '';
  successMessage = '';
  disponibiliteMessage = '';
  disponibiliteError = '';
  collaborateurId: number | null = null;
  photoUrl: string | null = null;
  pendingPhotoUrl: string | null = null;
  private photoVersion = Date.now();

  // Form fields
  firstName = '';
  lastName = '';
  email = '';
  telephone = '';
  poste = 'Collaborateur';
  departement = '';
  competences: string[] = ['Angular', 'Java', 'SQL'];
  showSkillInput = false;
  newSkill = '';
  competencesModifiees = false;

  // Password fields
  motDePasseActuel = '';
  nouveauMotDePasse = '';
  confirmationMotDePasse = '';
  isChangingPassword = false;
  passwordError = '';
  passwordSuccess = '';

  availableCompetences: Competence[] = [];
  selectedCompetences: Competence[] = [];
  experienceAnnees = 0;
  isDisponible = true;
  missions: Affectation[] = [];

  readonly permissions = [
    { label: 'Voir ses projets',          icon: 'ti ti-folder',     allowed: true  },
    { label: 'Mettre à jour ses tâches',  icon: 'ti ti-check',      allowed: true  },
    { label: 'Modifier son profil',        icon: 'ti ti-user',       allowed: true  },
    { label: 'Affecter des membres',       icon: '',                 allowed: false },
    { label: 'Accès aux rapports',         icon: '',                 allowed: false },
    { label: 'Gestion des projets',        icon: '',                 allowed: false },
  ];

  constructor(
    private readonly authService: AuthService,
    private readonly collaborateurService: CollaborateurService,
    private readonly competenceService: CompetenceService,
    private readonly affectationService: AffectationService,
    private readonly router: Router,
    private readonly cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void { this.loadProfile(); }

  // ── Computed ────────────────────────────────────────────────

  get userInitials(): string {
    const f = this.firstName?.[0] ?? '';
    const l = this.lastName?.[0] ?? '';
    return (f + l).toUpperCase() || 'CD';
  }

  get fullName(): string {
    return `${this.firstName} ${this.lastName}`.trim() || 'Collaborateur Demo';
  }

  get displayPhotoUrl(): string | null {
    const currentPhoto = this.pendingPhotoUrl || this.photoUrl;

    if (!currentPhoto) {
      return null;
    }

    if (currentPhoto.startsWith('data:')) {
      return currentPhoto;
    }

    const separator = currentPhoto.includes('?') ? '&' : '?';
    return `${currentPhoto}${separator}v=${this.photoVersion}`;
  }

  get allowedCount(): number {
    return this.permissions.filter(p => p.allowed).length;
  }

  get completionRate(): number {
    const fields = [
      this.firstName, this.lastName, this.email, this.telephone, this.poste,
      this.competences.length ? 'ok' : ''
    ];
    const filled = fields.filter(f => !!f).length;
    return Math.round((filled / fields.length) * 100);
  }

  get missingFields(): string {
    const missing: string[] = [];
    if (!this.competences.length) missing.push('Compétences');
    if (!this.telephone) missing.push('Téléphone');
    missing.push('Photo de profil');
    return missing.join(', ');
  }

  trackByIndex(index: number): number {
    return index;
  }

  get chargePercent(): number {
    const active = this.missions.filter(m => m.projet.statut !== 'termine').length;
    if (!active) return 0;
    return Math.min(100, active * 26);
  }

  missionDotColor(statut: string): string {
    switch ((statut || '').toLowerCase()) {
      case 'termine':  return '#10b981';
      case 'actif':    return '#3b82f6';
      default:         return '#f59e0b';
    }
  }

  missionStatusLabel(statut: string): string {
    switch ((statut || '').toLowerCase()) {
      case 'actif':      return 'En cours';
      case 'planifie':   return 'Planifié';
      case 'en_attente': return 'En attente';
      case 'termine':    return 'Terminé';
      case 'suspendu':   return 'Suspendu';
      default:           return 'Inconnu';
    }
  }

  missionClient(mission: Affectation): string {
    return (mission.projet as any).client ?? 'Client';
  }

  missionPeriod(mission: Affectation): string {
    const fmt = (d: string) => new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short' }).format(new Date(d));
    const s = mission.projet.dateDebut ? fmt(mission.projet.dateDebut) : '';
    const e = mission.projet.dateFin   ? fmt(mission.projet.dateFin)   : '';
    return s && e ? `${s} – ${e}` : s || e;
  }

  // ── Actions ─────────────────────────────────────────────────

  refresh(): void {
    this.loadProfile();
  }

  removeCompetence(index: number): void {
    if (index < 0 || index >= this.competences.length) {
      return;
    }

    this.competencesModifiees = true;
    this.competences = this.competences.filter((_, i) => i !== index);
    this.syncSelectedCompetencesFromNames();
  }

  showAddSkillInput(): void {
    this.showSkillInput = true;
    setTimeout(() => {
      const input = document.getElementById('skill-input') as HTMLInputElement | null;
      if (input) {
        input.focus();
      }
    }, 50);
  }

  addCompetence(): void {
    const skill = this.newSkill.trim();
    if (skill) {
      const exists = this.competences.some((existingSkill) => existingSkill.toLowerCase() === skill.toLowerCase());
      if (!exists) {
        this.competencesModifiees = true;
        this.competences = [...this.competences, skill];
      }
    }

    this.newSkill = '';
    this.showSkillInput = false;
    this.syncSelectedCompetencesFromNames();
  }

  onSkillKeyDown(event: KeyboardEvent): void {
    if (event.key === 'Enter') {
      event.preventDefault();
      this.addCompetence();
      return;
    }

    if (event.key === 'Escape') {
      this.newSkill = '';
      this.showSkillInput = false;
    }
  }

  onPhotoChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      this.pendingPhotoUrl = reader.result as string;
      this.photoVersion = Date.now();
      this.cdr.detectChanges();
    };
    reader.readAsDataURL(file);
  }

  saveProfile(): void {
    if (this.isSaving || this.collaborateurId === null) return;
    if (!this.firstName.trim() || !this.lastName.trim() || !this.email.trim()) {
      this.errorMessage = 'Le prénom, le nom et l\'email sont requis.';
      return;
    }
    this.isSaving = true;
    this.errorMessage = '';
    this.successMessage = '';

    this.ensureCompetencesExist().pipe(
      switchMap(() => {
        const payload: CollaborateurRequest = {
          prenom: this.firstName.trim(),
          nom: this.lastName.trim(),
          email: this.email.trim(),
          telephone: this.telephone.trim(),
          photoUrl: this.pendingPhotoUrl || this.photoUrl || null,
          departement: this.departement.trim() || undefined,
          experienceAnnees: this.experienceAnnees,
          disponible: this.isDisponible,
          competenceIds: this.resolveCompetenceIds()
        };

        return this.collaborateurService.update(this.collaborateurId!, payload).pipe(
          switchMap((updated) =>
            this.authService.updateProfile({
              nom: `${payload.prenom} ${payload.nom}`.trim(),
              email: payload.email,
              telephone: payload.telephone,
              poste: this.poste.trim(),
              departement: payload.departement,
              photoUrl: payload.photoUrl
            }).pipe(map(() => ({ updated, payload })))
          )
        );
      })
    ).subscribe({
      next: ({ updated, payload }) => {
        this.selectedCompetences = updated.competences ?? this.selectedCompetences;
        this.syncCompetenceNamesFromSelected();
        this.competencesModifiees = false;
        this.photoUrl = updated.photoUrl ?? this.pendingPhotoUrl ?? this.photoUrl;
        this.pendingPhotoUrl = null;
        this.photoVersion = Date.now();
        this.successMessage = 'Profil collaborateur mis à jour.';
        this.isSaving = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.errorMessage = 'Impossible d\'enregistrer les modifications.';
        this.isSaving = false;
        this.cdr.detectChanges();
      }
    });
  }

  changerMotDePasse(): void {
    if (this.isChangingPassword) {
      return;
    }

    this.passwordError = '';
    this.passwordSuccess = '';

    if (!this.motDePasseActuel || !this.nouveauMotDePasse || !this.confirmationMotDePasse) {
      this.passwordError = 'Veuillez remplir tous les champs.';
      return;
    }

    if (this.nouveauMotDePasse.length < 8) {
      this.passwordError = 'Le nouveau mot de passe doit contenir au moins 8 caractères.';
      return;
    }

    if (this.nouveauMotDePasse !== this.confirmationMotDePasse) {
      this.passwordError = 'Le nouveau mot de passe et la confirmation ne correspondent pas.';
      return;
    }

    if (this.nouveauMotDePasse === this.motDePasseActuel) {
      this.passwordError = 'Le nouveau mot de passe doit être différent de l\'actuel.';
      return;
    }

    this.isChangingPassword = true;

    this.authService.changePassword({
      motDePasseActuel: this.motDePasseActuel,
      nouveauMotDePasse: this.nouveauMotDePasse,
      confirmationMotDePasse: this.confirmationMotDePasse
    }).subscribe({
      next: () => {
        this.passwordSuccess = 'Mot de passe modifié avec succès.';
        this.motDePasseActuel = '';
        this.nouveauMotDePasse = '';
        this.confirmationMotDePasse = '';
        this.isChangingPassword = false;
        this.cdr.detectChanges();
      },
      error: (err: { status?: number; error?: { message?: string } }) => {
        if (err?.status === 401 || err?.status === 400) {
          this.passwordError = err?.error?.message ?? 'Mot de passe actuel incorrect.';
        } else {
          this.passwordError = 'Une erreur est survenue. Veuillez réessayer.';
        }
        this.isChangingPassword = false;
        this.cdr.detectChanges();
      }
    });
  }

  onDisponibiliteToggle(nextValue: boolean): void {
    if (this.collaborateurId === null || this.isUpdatingDisponibilite) {
      return;
    }

    const previousValue = this.isDisponible;
    this.isDisponible = nextValue;
    this.disponibiliteMessage = '';
    this.disponibiliteError = '';
    this.isUpdatingDisponibilite = true;

    const payload: CollaborateurRequest = {
      prenom: this.firstName.trim(),
      nom: this.lastName.trim(),
      email: this.email.trim(),
      telephone: this.telephone.trim(),
      departement: this.departement.trim() || undefined,
      experienceAnnees: this.experienceAnnees,
      disponible: this.isDisponible,
      competenceIds: this.resolveCompetenceIds()
    };

    this.collaborateurService.update(this.collaborateurId, payload).subscribe({
      next: () => {
        this.disponibiliteMessage = this.isDisponible
          ? 'Disponibilité mise à jour : Disponible.'
          : 'Disponibilité mise à jour : En congé.';
        this.isUpdatingDisponibilite = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.isDisponible = previousValue;
        this.disponibiliteError = 'Impossible de mettre à jour la disponibilité.';
        this.isUpdatingDisponibilite = false;
        this.cdr.detectChanges();
      }
    });
  }

  // ── Loading ──────────────────────────────────────────────────

  private loadProfile(): void {
    this.isLoading = true;
    this.loadError = '';
    const session = this.authService.currentUser;
    const normalizedEmail = session?.email?.trim();

    if (!session || !normalizedEmail) {
      this.loadError = 'Session collaborateur introuvable.';
      this.isLoading = false;
      this.cdr.detectChanges();
      return;
    }

    forkJoin({
      profile: this.authService.getCurrentProfile().pipe(
        catchError(() => of(null))
      ),
      collaborateur: this.collaborateurService.getByEmail(normalizedEmail).pipe(
        catchError(() => {
          console.warn('Impossible de charger le collaborateur par email');
          return of(null);
        })
      ),
      competences: this.competenceService.getAll().pipe(
        catchError(() => {
          console.warn('Impossible de charger les compétences disponibles');
          return of([]);
        })
      )
    }).pipe(
      switchMap(({ profile, collaborateur, competences }) => {
        this.availableCompetences = competences;
        if (!collaborateur?.id) {
          this.loadError = 'Collaborateur introuvable pour ce compte.';
          return of({ collaborateur: null as Collaborateur | null, affectations: [] as Affectation[] });
        }
        this.collaborateurId = collaborateur.id;
        this.selectedCompetences = collaborateur.competences ?? [];
        this.syncCompetenceNamesFromSelected();
        this.competencesModifiees = false;
        this.photoUrl = collaborateur.photoUrl ?? null;
        this.pendingPhotoUrl = null;
        this.photoVersion = Date.now();
        this.experienceAnnees = collaborateur.experienceAnnees;
        this.isDisponible = collaborateur.disponible;
        this.firstName = collaborateur.prenom;
        this.lastName = collaborateur.nom;
        this.email = collaborateur.email;
        this.telephone = collaborateur.telephone ?? '';
        this.departement = collaborateur.departement ?? '';
        this.poste = profile?.poste ?? '';
        return this.affectationService.getByCollaborateur(collaborateur.id).pipe(
          catchError(() => {
            console.warn('Impossible de charger les affectations, continuant sans...');
            return of([]);
          }),
          switchMap((affectations) => of({ collaborateur, affectations }))
        );
      })
    ).subscribe({
      next: ({ collaborateur, affectations }) => {
        if (!collaborateur) { this.isLoading = false; this.cdr.detectChanges(); return; }
        this.missions = affectations;
        this.isLoading = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.loadError = 'Impossible de charger la page Mon Profil.';
        this.isLoading = false;
        this.cdr.detectChanges();
      }
    });
  }

  private syncCompetenceNamesFromSelected(): void {
    const names = this.selectedCompetences
      .map((competence) => (competence.nom ?? '').trim())
      .filter((name) => !!name);

    this.competences = names.length ? [...new Set(names)] : ['Angular', 'Java', 'SQL'];
  }

  private syncSelectedCompetencesFromNames(): void {
    const byName = new Map(
      this.availableCompetences.map((competence) => [competence.nom.toLowerCase(), competence] as const)
    );

    this.selectedCompetences = this.competences.map((name, index) => {
      const existing = byName.get(name.toLowerCase());
      if (existing) {
        return existing;
      }

      return {
        id: -(index + 1),
        nom: name
      } as Competence;
    });
  }

  private resolveCompetenceIds(): number[] {
    const byName = new Map(
      this.availableCompetences.map((competence) => [competence.nom.toLowerCase(), competence.id] as const)
    );

    return this.competences
      .map((name) => byName.get(name.toLowerCase()))
      .filter((id): id is number => typeof id === 'number');
  }

  private ensureCompetencesExist() {
    const normalized = this.competences
      .map((name) => name.trim())
      .filter((name) => !!name);

    const existingByName = new Set(this.availableCompetences.map((competence) => competence.nom.toLowerCase()));
    const missingNames = [...new Set(normalized.filter((name) => !existingByName.has(name.toLowerCase())))];

    if (!missingNames.length) {
      return of(this.availableCompetences);
    }

    const creations = missingNames.map((name) =>
      this.competenceService.create(name).pipe(
        catchError(() =>
          this.competenceService.getAll().pipe(
            map((allCompetences) => {
              const existing = allCompetences.find((competence) => competence.nom.toLowerCase() === name.toLowerCase());
              if (!existing) {
                throw new Error(`Impossible de créer la compétence: ${name}`);
              }

              return existing;
            })
          )
        )
      )
    );

    return forkJoin(creations).pipe(
      map((createdCompetences) => {
        const merged = [...this.availableCompetences];
        createdCompetences.forEach((created) => {
          if (!merged.some((competence) => competence.id === created.id)) {
            merged.push(created);
          }
        });
        this.availableCompetences = merged;
        this.syncSelectedCompetencesFromNames();
        return merged;
      })
    );
  }
}
