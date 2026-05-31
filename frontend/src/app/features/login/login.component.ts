import { Component } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { finalize } from 'rxjs';
import { AuthService, getDefaultRouteForRole } from '../../services/auth';
import { extractAuthErrorMessage } from '../shared/auth-error.utils';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [FormsModule, CommonModule, RouterLink],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss'
})
export class LoginComponent {

  // Champs formulaire
  email: string = '';
  password: string = '';
  rememberMe: boolean = false;
  showPassword: boolean = false;

  // Rôle sélectionné
  selectedRole: 'admin' | 'manager' | 'collab' = 'admin';

  // États
  isSubmitting: boolean = false;
  errorMessage: string = '';
  emailError: string = '';
  passwordError: string = '';

  constructor(
    private readonly router: Router,
    private readonly auth: AuthService
  ) {}

  selectRole(role: 'admin' | 'manager' | 'collab'): void {
    this.selectedRole = role;
    this.errorMessage = '';
    this.emailError = '';
    this.passwordError = '';

    if (role === 'admin') {
      this.email = 'admin@smartassign.tn';
      this.password = 'Admin123';
    } else if (role === 'manager') {
      this.email = 'manager@smartassign.tn';
      this.password = 'Manager123';
    } else {
      this.email = 'collab@smartassign.tn';
      this.password = 'Collab123';
    }
  }

  onCredentialsChange(field: 'email' | 'password'): void {
    if (field === 'email') this.emailError = '';
    if (field === 'password') this.passwordError = '';
    this.errorMessage = '';
  }

  onRememberMeChange(checked: boolean): void {
    this.rememberMe = checked;
  }

  togglePassword(): void {
    this.showPassword = !this.showPassword;
  }

  submit(): void {
    this.emailError = '';
    this.passwordError = '';
    this.errorMessage = '';

    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!this.email.trim()) {
      this.emailError = 'Veuillez saisir votre adresse e-mail.';
    } else if (!emailPattern.test(this.email.trim())) {
      this.emailError = 'Adresse e-mail invalide.';
    }

    if (!this.password) {
      this.passwordError = 'Veuillez saisir votre mot de passe.';
    }

    if (this.emailError || this.passwordError) return;

    this.isSubmitting = true;

    this.auth.login(this.email.trim().toLowerCase(), this.password)
      .pipe(finalize(() => { this.isSubmitting = false; }))
      .subscribe({
        next: (user) => {
          this.router.navigateByUrl(getDefaultRouteForRole(user.role));
        },
        error: (error) => {
          this.errorMessage = extractAuthErrorMessage(
            error,
            'Email ou mot de passe incorrect.'
          );
        }
      });
  }
}