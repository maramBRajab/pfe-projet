import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';

import { AuthService } from '../../services/auth';
import { extractAuthErrorMessage } from '../shared/auth-error.utils';
import { RevealOnScrollDirective } from '../shared/reveal-on-scroll.directive';

@Component({
  selector: 'app-forgot-password',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, RevealOnScrollDirective],
  templateUrl: './forgot-password.component.html',
  styleUrl: './forgot-password.component.scss'
})
export class ForgotPasswordComponent {
  email = '';
  isSubmitting = false;
  errorMessage = '';
  successMessage = '';

  constructor(private readonly authService: AuthService) {}

  submit(): void {
    if (this.isSubmitting || !this.email.trim()) {
      return;
    }

    this.isSubmitting = true;
    this.errorMessage = '';
    this.successMessage = '';

    this.authService.forgotPassword(this.email.trim()).subscribe({
      next: (response) => {
        this.isSubmitting = false;
        this.successMessage = response.message;
      },
      error: (error) => {
        this.isSubmitting = false;
        this.errorMessage = extractAuthErrorMessage(error, 'Impossible d envoyer le lien de reinitialisation.');
      }
    });
  }
}