import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { finalize } from 'rxjs';

import { AuthService } from '../../services/auth';
import { extractAuthErrorMessage } from '../shared/auth-error.utils';

@Component({
  selector: 'app-forgot-password',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './forgot-password.component.html',
  styleUrl: './forgot-password.component.scss'
})
export class ForgotPasswordComponent {
  email = '';
  emailError = '';
  isSubmitting = false;
  submitted = false;
  errorMessage = '';
  successMessage = '';

  constructor(private readonly authService: AuthService) {}

  onEmailChange(): void {
    if (this.submitted) {
      return;
    }
    this.emailError = '';
    this.errorMessage = '';
  }

  submit(): void {
    if (this.isSubmitting) {
      return;
    }

    this.emailError = '';
    this.errorMessage = '';
    this.successMessage = '';

    const trimmedEmail = this.email.trim();
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!trimmedEmail) {
      this.emailError = 'Veuillez saisir votre adresse e-mail.';
    } else if (!emailPattern.test(trimmedEmail)) {
      this.emailError = 'Adresse e-mail invalide.';
    }

    if (this.emailError) {
      return;
    }

    this.isSubmitting = true;

    this.authService
      .forgotPassword(trimmedEmail)
      .pipe(finalize(() => {
        this.isSubmitting = false;
      }))
      .subscribe({
        next: (response) => {
          this.submitted = true;
          this.errorMessage = '';
          this.successMessage =
            response?.message
            ?? 'Si un compte existe pour cette adresse, un lien de réinitialisation a été envoyé.';
        },
        error: (error) => {
          this.submitted = false;
          this.successMessage = '';
          this.errorMessage = extractAuthErrorMessage(
            error,
            'Impossible d\'envoyer le lien de réinitialisation. Réessayez plus tard.'
          );
        }
      });
  }
}
