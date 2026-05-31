/** Routes admin valides — source unique pour la navigation du dashboard et des menus. */
export const ADMIN_NAV = {
  dashboard: '/admin/dashboard',
  collaborateurs: '/admin/collaborateurs',
  collaborateursNouveau: '/admin/collaborateurs/nouveau',
  projets: '/admin/projets',
  roles: '/admin/roles',
  audit: '/admin/audit',
  rapports: '/admin/rapports',
  notifications: '/admin/notifications',
  parametres: '/admin/parametres',
  profil: '/admin/profil',
  /** Liste des affectations en cours (page manager, accessible aussi aux admins). */
  affectations: '/manager/affectations-en-cours',
  /** Outil d'analyse / recommandations d'affectation. */
  affectationAnalyse: '/manager/affectation',
} as const;

export type AdminProjetStatutFilter = 'en_cours' | 'en_attente' | 'termine' | 'en_retard';

export interface AdminNavigationTarget {
  path: string;
  queryParams?: Record<string, string>;
}

export function adminProjetsTarget(statut?: AdminProjetStatutFilter): AdminNavigationTarget {
  if (!statut) {
    return { path: ADMIN_NAV.projets };
  }

  return {
    path: ADMIN_NAV.projets,
    queryParams: { statut },
  };
}

export function adminCollaborateurTarget(id?: number): AdminNavigationTarget {
  if (typeof id === 'number') {
    return { path: `/admin/collaborateurs/edit/${id}` };
  }

  return { path: ADMIN_NAV.collaborateurs };
}

export function adminProjetTarget(id?: number): AdminNavigationTarget {
  if (typeof id === 'number') {
    return { path: `/admin/projets/edit/${id}` };
  }

  return { path: ADMIN_NAV.projets };
}
