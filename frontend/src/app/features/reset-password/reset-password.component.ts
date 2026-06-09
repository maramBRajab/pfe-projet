import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';

import { AuthService } from '../../services/auth';
import { extractAuthErrorMessage } from '../shared/auth-error.utils';

@Component({
  selector: 'app-reset-password',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './reset-password.component.html',
  styleUrl: './reset-password.component.scss'
})
export class ResetPasswordComponent implements OnInit {
  token = '';
  newPassword = '';
  confirmPassword = '';
  showNewPassword = false;
  showConfirmPassword = false;
  isCheckingToken = true;
  isSubmitting = false;
  errorMessage = '';
  successMessage = '';
  tokenErrorMessage = '';

  constructor(
    private readonly authService: AuthService,
    private readonly route: ActivatedRoute,
    private readonly router: Router
  ) {}

  ngOnInit(): void {
    this.route.queryParamMap.subscribe((params) => {
      this.token = (params.get('token') ?? '').trim();
      this.errorMessage = '';
      this.successMessage = '';
      this.tokenErrorMessage = '';

      if (!this.token) {
        this.isCheckingToken = false;
        this.tokenErrorMessage = 'Le lien de reinitialisation est invalide.';
        return;
      }

      this.isCheckingToken = true;
      this.authService.validateResetPasswordToken(this.token).subscribe({
        next: () => {
          this.isCheckingToken = false;
        },
        error: (error) => {
          this.isCheckingToken = false;
          this.tokenErrorMessage = extractAuthErrorMessage(error, 'Le lien de reinitialisation est invalide ou expire.');
        }
      });
    });
  }

  submit(): void {
    if (this.isSubmitting || this.isCheckingToken || this.tokenErrorMessage || !this.newPassword || !this.confirmPassword) {
      return;
    }

    this.isSubmitting = true;
    this.errorMessage = '';
    this.successMessage = '';

    this.authService.resetPassword(this.token, this.newPassword, this.confirmPassword).subscribe({
      next: (response) => {
        this.isSubmitting = false;
        this.successMessage = response.message;
        this.newPassword = '';
        this.confirmPassword = '';
        setTimeout(() => void this.router.navigateByUrl('/login'), 1800);
      },
      error: (error) => {
        this.isSubmitting = false;
        this.errorMessage = extractAuthErrorMessage(error, 'Impossible de modifier le mot de passe.');
      }
    });
  }

  toggleNewPassword(): void {
    this.showNewPassword = !this.showNewPassword;
  }

  toggleConfirmPassword(): void {
    this.showConfirmPassword = !this.showConfirmPassword;
  }
}