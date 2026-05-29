import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { forkJoin, of, switchMap } from 'rxjs';

import { Affectation, AffectationService, Collaborateur, CollaborateurRequest, CollaborateurService, Competence, CompetenceService } from '../../../services/collaborateur';
import { AuthService } from '../../../services/auth';
import { CollaborateurShellComponent } from '../shared/collaborateur-shell.component';

interface LocalProfileExtras { telephone: string; departement: string; poste: string; }

@Component({
  selector: 'app-collaborateur-profil',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, CollaborateurShellComponent],
  templateUrl: './profil.component.html',
  styleUrl: './profil.component.scss'
})
export class CollaborateurProfilComponent implements OnInit {
  isLoading = true;
  isSaving = false;
  loadError = '';
  errorMessage = '';
  successMessage = '';
  collaborateurId: number | null = null;

  // Form fields
  firstName = '';
  lastName = '';
  email = '';
  telephone = '';
  poste = 'Collaborateur';
  departement = '';
  newCompetenceName = '';

  // Password fields
  currentPassword = '';
  newPassword = '';
  confirmPassword = '';
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

  get allowedCount(): number {
    return this.permissions.filter(p => p.allowed).length;
  }

  get completionRate(): number {
    const fields = [
      this.firstName, this.lastName, this.email, this.telephone, this.poste,
      this.selectedCompetences.length ? 'ok' : ''
    ];
    const filled = fields.filter(f => !!f).length;
    return Math.round((filled / fields.length) * 100);
  }

  get missingFields(): string {
    const missing: string[] = [];
    if (!this.selectedCompetences.length) missing.push('Compétences');
    if (!this.telephone) missing.push('Téléphone');
    missing.push('Photo de profil');
    return missing.join(', ');
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

  addCompetence(): void {
    const name = this.newCompetenceName.trim();
    if (!name) return;
    const existing = this.availableCompetences.find(c => c.nom.toLowerCase() === name.toLowerCase());
    if (existing && !this.selectedCompetences.find(c => c.id === existing.id)) {
      this.selectedCompetences = [...this.selectedCompetences, existing];
    } else if (!existing) {
      // Add as pseudo-competence for display
      this.selectedCompetences = [...this.selectedCompetences, { id: Date.now(), nom: name } as Competence];
    }
    this.newCompetenceName = '';
  }

  removeCompetence(comp: Competence): void {
    this.selectedCompetences = this.selectedCompetences.filter(c => c.id !== comp.id);
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

    const payload: CollaborateurRequest = {
      prenom: this.firstName.trim(),
      nom: this.lastName.trim(),
      email: this.email.trim(),
      experienceAnnees: this.experienceAnnees,
      disponible: this.isDisponible,
      competenceIds: this.selectedCompetences.map(c => c.id).filter((id): id is number => typeof id === 'number')
    };

    this.collaborateurService.update(this.collaborateurId, payload).subscribe({
      next: (updated) => {
        this.selectedCompetences = updated.competences ?? this.selectedCompetences;
        this.authService.updateStoredUser(`${payload.prenom} ${payload.nom}`.trim(), payload.email);
        this.persistLocalExtras(payload.email);
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

  savePassword(): void {
    this.passwordError = '';
    this.passwordSuccess = '';
    if (!this.currentPassword || !this.newPassword || !this.confirmPassword) {
      this.passwordError = 'Tous les champs sont requis.';
      return;
    }
    if (this.newPassword !== this.confirmPassword) {
      this.passwordError = 'Les mots de passe ne correspondent pas.';
      return;
    }
    // Simulate success (no real endpoint)
    this.passwordSuccess = 'Mot de passe mis à jour.';
    this.currentPassword = '';
    this.newPassword = '';
    this.confirmPassword = '';
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
      collaborateur: this.collaborateurService.getByEmail(normalizedEmail),
      competences: this.competenceService.getAll()
    }).pipe(
      switchMap(({ collaborateur, competences }) => {
        this.availableCompetences = competences;
        if (!collaborateur?.id) {
          this.loadError = 'Collaborateur introuvable pour ce compte.';
          return of({ collaborateur: null as Collaborateur | null, affectations: [] as Affectation[] });
        }
        this.collaborateurId = collaborateur.id;
        this.selectedCompetences = collaborateur.competences ?? [];
        this.experienceAnnees = collaborateur.experienceAnnees;
        this.isDisponible = collaborateur.disponible;
        this.firstName = collaborateur.prenom;
        this.lastName = collaborateur.nom;
        this.email = collaborateur.email;
        this.restoreLocalExtras(collaborateur.email);
        return this.affectationService.getByCollaborateur(collaborateur.id).pipe(
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

  private restoreLocalExtras(email: string): void {
    try {
      const raw = localStorage.getItem(this.getStorageKey(email));
      if (!raw) return;
      const extras = JSON.parse(raw) as Partial<LocalProfileExtras>;
      this.telephone  = extras.telephone  ?? '';
      this.departement = extras.departement ?? '';
      this.poste      = extras.poste      ?? 'Collaborateur';
    } catch { localStorage.removeItem(this.getStorageKey(email)); }
  }

  private persistLocalExtras(email: string): void {
    const extras: LocalProfileExtras = { telephone: this.telephone.trim(), departement: this.departement.trim(), poste: this.poste.trim() };
    localStorage.setItem(this.getStorageKey(email), JSON.stringify(extras));
  }

  private getStorageKey(email: string): string {
    return `smartassign_collab_profile_${email.toLowerCase()}`;
  }
}
