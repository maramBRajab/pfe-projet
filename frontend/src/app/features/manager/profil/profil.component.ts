import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { catchError, forkJoin, of } from 'rxjs';
import { AuthService } from '../../../services/auth';
import { Affectation, AffectationService, Collaborateur, CollaborateurService, Projet, ProjetService } from '../../../services/manager';

@Component({
  selector: 'app-manager-profil',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './profil.component.html',
  styleUrl: './profil.component.scss'
})
export class ManagerProfilComponent implements OnInit {

  // form fields
  prenom = 'Manager';
  nom = 'SmartAssign';
  email = 'manager@smartassign.tn';
  telephone = '+216 24 333 444';
  poste = 'Manager delivery';

  // password fields
  currentPassword = '';
  newPassword = '';
  confirmPassword = '';

  // feedback
  feedbackMsg = '';
  feedbackTone: 'success' | 'error' | '' = '';
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
    const user = this.authService.currentUser;
    if (user?.nom) {
      const parts = user.nom.trim().split(/\s+/);
      this.prenom = parts[0] ?? 'Manager';
      this.nom = parts.slice(1).join(' ') || 'SmartAssign';
    }
    if (user?.email) { this.email = user.email; }

    const extras = this.loadExtras(this.email);
    if (extras.telephone) { this.telephone = extras.telephone; }
    if (extras.poste)     { this.poste = extras.poste; }

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

  saveProfile(): void {
    const fullName = `${this.prenom.trim()} ${this.nom.trim()}`.trim();
    this.authService.updateStoredUser(fullName, this.email.trim());
    this.saveExtras(this.email, { telephone: this.telephone, poste: this.poste });
    this.feedbackMsg  = 'Profil mis à jour avec succès.';
    this.feedbackTone = 'success';
  }

  cancelEdit(): void {
    this.ngOnInit();
    this.feedbackMsg  = '';
    this.feedbackTone = '';
  }

  changePassword(): void {
    if (!this.currentPassword || !this.newPassword || !this.confirmPassword) {
      this.pwdMsg  = 'Veuillez remplir tous les champs.';
      this.pwdTone = 'error';
      return;
    }
    if (this.newPassword !== this.confirmPassword) {
      this.pwdMsg  = 'Les mots de passe ne correspondent pas.';
      this.pwdTone = 'error';
      return;
    }
    this.pwdMsg  = 'Mot de passe mis à jour.';
    this.pwdTone = 'success';
    this.currentPassword = '';
    this.newPassword     = '';
    this.confirmPassword = '';
  }

  refresh(): void { this.ngOnInit(); }

  logout(): void {
    this.authService.logout();
    void this.router.navigate(['/login']);
  }

  private loadExtras(email: string): { telephone: string; poste: string } {
    try {
      const raw = localStorage.getItem(`smartassign_mp_${email.toLowerCase()}`);
      if (!raw) { return { telephone: '', poste: '' }; }
      return JSON.parse(raw) as { telephone: string; poste: string };
    } catch {
      return { telephone: '', poste: '' };
    }
  }

  private saveExtras(email: string, extras: { telephone: string; poste: string }): void {
    localStorage.setItem(`smartassign_mp_${email.toLowerCase()}`, JSON.stringify(extras));
  }
}
