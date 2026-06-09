import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';

type VerifyState = 'loading' | 'success' | 'error' | 'invalid';

@Component({
  selector: 'app-verify-email',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './verify-email.component.html',
  styleUrl: './verify-email.component.scss'
})
export class VerifyEmailComponent implements OnInit {
  state: VerifyState = 'loading';
  message = '';

  constructor(
    private readonly route: ActivatedRoute,
    private readonly http: HttpClient
  ) {}

  ngOnInit(): void {
    const token = this.route.snapshot.queryParamMap.get('token')?.trim() ?? '';

    if (!token) {
      this.state = 'invalid';
      this.message = 'Le lien de vérification est manquant ou invalide.';
      return;
    }

    this.http
      .get<{ message: string }>(`${environment.apiUrl}/auth/verify-email`, {
        params: { token }
      })
      .subscribe({
        next: (response) => {
          this.state = 'success';
          this.message = response?.message ?? 'Votre adresse email a été vérifiée avec succès.';
        },
        error: (error) => {
          this.state = 'error';
          const apiMessage: string | undefined =
            (error?.error as { message?: string } | null | undefined)?.message;
          this.message = apiMessage ?? 'Ce lien est invalide ou a expiré. Demandez un nouveau lien à votre administrateur.';
        }
      });
  }
}
