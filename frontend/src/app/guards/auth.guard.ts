import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService, getDefaultRouteForRole, normalizeUserRole } from '../services/auth';

export const authGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router);
  const user = authService.currentUser;

  if (user) {
    return true;
  }

  return router.createUrlTree(['/login']);
};

export const roleGuard = (allowedRoles: string[]): CanActivateFn => {
  return () => {
    const authService = inject(AuthService);
    const router = inject(Router);
    const user = authService.currentUser;
    const userRole = normalizeUserRole(user?.role);
    const normalizedAllowedRoles = allowedRoles.map((role) => normalizeUserRole(role));

    if (user && normalizedAllowedRoles.includes(userRole)) {
      return true;
    }

    if (user) {
      return router.parseUrl(getDefaultRouteForRole(userRole));
    }

    return router.createUrlTree(['/login']);
  };
};