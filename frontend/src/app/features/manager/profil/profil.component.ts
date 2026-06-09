import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { catchError, forkJoin, of } from 'rxjs';
import { AuthService } from '../../../services/auth';
import { Affectation, AffectationService, Collaborateur, CollaborateurService, Projet, ProjetService } from '../../../services/manager';
import { ManagerShellComponent } from '../shared/manager-shell.component';
import { ManagerTopbarComponent } from '../shared/manager-topbar.component';

@Component({
  selector: 'app-manager-profil',
  standalone: true,
  imports: [CommonModule, FormsModule, ManagerShellComponent, ManagerTopbarComponent],
  templateUrl: './profil.component.html',
  styleUrl: './profil.component.scss'
})
export class ManagerProfilComponent implements OnInit {

  // form fields
  prenom: string | null = 'Manager';
  nom: string | null = 'SmartAssign';
  email = 'manager@smartassign.tn';
  telephone = '+216 24 333 444';
  poste = 'Manager delivery';
  departement = '';

  // photo
  photoUrl: string | null = null;

  // password fields
  currentPassword = '';
  newPassword = '';
  confirmPassword = '';

  // feedback
  feedbackMsg = '';
  feedbackTone: 'success' | 'error' | '' = '';
  isSaving = false;
  pwdMsg = '';
  pwdTone: 'success' | 'error' | '' = '';

  // KPI counters
  projetsCount = 0;
  collaborateursCount = 0;
  affectationsCount = 0;

  constructor(
    private readonly authService: AuthService,
    private readonly collaborateurService: CollaborateurService,
    private readonly projetService: ProjetService,
    private readonly affectationService: AffectationService,
    private readonly router: Router
  ) {}

  ngOnInit(): void {
    this.loadProfileFromApi();

    forkJoin({
      collaborateurs: this.collaborateurService.getAll().pipe(catchError(() => of([] as Collaborateur[]))),
      projets:        this.projetService.getAll().pipe(catchError(() => of([] as Projet[]))),
      affectations:   this.affectationService.getAll().pipe(catchError(() => of([] as Affectation[])))
    }).subscribe(({ collaborateurs, projets, affectations }) => {
      this.projetsCount        = projets.length;
      this.collaborateursCount = collaborateurs.length;
      this.affectationsCount   = affectations.length;
    });
  }

  private loadProfileFromApi(): void {
    this.authService.getCurrentProfile().subscribe({
      next: (user) => {
        const parts = (user.nom || '').trim().split(/\s+/).filter(Boolean);
        this.prenom = parts[0] ?? '';
        this.nom = parts.slice(1).join(' ');
        this.email = user.email ?? '';
        this.telephone = user.telephone ?? '';
        this.poste = user.poste ?? '';
        this.departement = user.departement ?? '';
        this.photoUrl = user.photoUrl ?? null;
      },
      error: () => {
        this.feedbackMsg = 'Impossible de charger le profil depuis le serveur.';
        this.feedbackTone = 'error';
      }
    });
  }

  saveProfile(): void {
    if (this.isSaving) return;
    this.isSaving = true;
    this.feedbackMsg = '';
    this.feedbackTone = '';

    const nom = `${(this.prenom ?? '').trim()} ${(this.nom ?? '').trim()}`.trim();

    this.authService.updateProfile({
      nom,
      email: this.email.trim(),
      telephone: this.telephone.trim(),
      poste: this.poste.trim(),
      departement: this.departement.trim()
    }).subscribe({
      next: (_updatedUser) => {
        this.isSaving = false;
        this.feedbackMsg = 'Profil mis à jour avec succès.';
        this.feedbackTone = 'success';
      },
      error: () => {
        this.isSaving = false;
        this.feedbackMsg = 'Erreur lors de la mise à jour du profil.';
        this.feedbackTone = 'error';
      }
    });
  }

  cancelEdit(): void {
    this.ngOnInit();
    this.feedbackMsg  = '';
    this.feedbackTone = '';
  }

  changePassword(): void {
    if (!this.currentPassword || !this.newPassword || !this.confirmPassword) {
      this.pwdMsg = 'Veuillez remplir tous les champs.';
      this.pwdTone = 'error';
      return;
    }
    if (this.newPassword !== this.confirmPassword) {
      this.pwdMsg = 'Les mots de passe ne correspondent pas.';
      this.pwdTone = 'error';
      return;
    }

    this.authService.changePassword({
      motDePasseActuel: this.currentPassword,
      nouveauMotDePasse: this.newPassword,
      confirmationMotDePasse: this.confirmPassword
    }).subscribe({
      next: () => {
        this.pwdMsg = 'Mot de passe mis à jour avec succès.';
        this.pwdTone = 'success';
        this.currentPassword = '';
        this.newPassword = '';
        this.confirmPassword = '';
      },
      error: (err) => {
        const detail = err?.error?.message || '';
        this.pwdMsg = detail ? detail : 'Erreur lors du changement de mot de passe.';
        this.pwdTone = 'error';
      }
    });
  }

  refresh(): void { this.ngOnInit(); }

  logout(): void {
    this.authService.logout();
    void this.router.navigate(['/login']);
  }
  
  onPhotoChange(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      this.photoUrl = reader.result as string;
      this.authService.updateProfile({
        nom: `${(this.prenom ?? '').trim()} ${(this.nom ?? '').trim()}`.trim(),
        email: this.email.trim(),
        telephone: this.telephone.trim(),
        poste: this.poste.trim(),
        departement: this.departement.trim(),
        photoUrl: this.photoUrl
      }).subscribe({
        next: (updated) => {
          this.photoUrl = updated.photoUrl ?? this.photoUrl;
          this.feedbackMsg = 'Photo mise à jour avec succès.';
          this.feedbackTone = 'success';
        },
        error: () => {
          this.feedbackMsg = 'Erreur lors de la sauvegarde de la photo.';
          this.feedbackTone = 'error';
        }
      });
    };
    reader.readAsDataURL(file);
  }
}
