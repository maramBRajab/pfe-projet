import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService, getDefaultRouteForRole } from '../services/auth';

export const guestGuard: CanActivateFn = () => {
  const auth   = inject(AuthService);
  const router = inject(Router);

  if (!auth.isLoggedIn) {
    return true;
  }

  return router.parseUrl(getDefaultRouteForRole(auth.currentUser?.role));
};