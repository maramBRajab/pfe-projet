import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';

import { AuthService } from '../services/auth';

export const authInterceptor: HttpInterceptorFn = (request, next) => {
  const authService = inject(AuthService);
  const router = inject(Router);
  const token = authService.token;
  const hasSession = !!authService.currentUser;

  if (!token || request.headers.has('Authorization')) {
    return next(request).pipe(
      catchError((error: unknown) => {
        if (hasSession && error instanceof HttpErrorResponse && error.status === 401) {
          authService.logout();
          void router.navigate(['/login']);
        }

        return throwError(() => error);
      })
    );
  }

  return next(request.clone({
    setHeaders: {
      Authorization: `Bearer ${token}`
    }
  })).pipe(
    catchError((error: unknown) => {
      if (hasSession && error instanceof HttpErrorResponse && error.status === 401) {
        authService.logout();
        void router.navigate(['/login']);
      }

      return throwError(() => error);
    })
  );
};