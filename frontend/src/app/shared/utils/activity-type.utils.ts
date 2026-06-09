export type ActivityVisualType =
  | 'connexion'
  | 'creation'
  | 'modification'
  | 'suppression'
  | 'erreur'
  | 'verification'
  | 'parametres';

const TYPE_ALIASES: Record<string, ActivityVisualType> = {
  CONNEXION: 'connexion',
  LOGIN: 'connexion',
  LOGOUT: 'connexion',
  CREATION: 'creation',
  CREATION_USER: 'creation',
  CREATE: 'creation',
  CREATE_USER: 'creation',
  CREATE_PROJET: 'creation',
  MODIFICATION: 'modification',
  UPDATE: 'modification',
  UPDATE_USER: 'modification',
  UPDATE_PROJET: 'modification',
  ROLE_CHANGE: 'modification',
  ASSIGN: 'modification',
  RENVOI_EMAIL_VERIFICATION: 'verification',
  RESEND_VERIFICATION: 'verification',
  EMAIL_VERIFICATION_RESEND: 'verification',
  PARAMETRES: 'parametres',
  SETTINGS: 'parametres',
  SUPPRESSION: 'suppression',
  DELETE: 'suppression',
  DELETE_USER: 'suppression',
  DELETE_PROJET: 'suppression',
  UNASSIGN: 'suppression',
  ERREUR: 'erreur',
  LOGIN_FAILED: 'erreur',
  ERROR: 'erreur',
  FAILED: 'erreur',
};

const TYPE_ICONS: Record<ActivityVisualType, string> = {
  connexion: 'ti-login',
  creation: 'ti-plus',
  modification: 'ti-pencil',
  suppression: 'ti-trash',
  erreur: 'ti-alert-circle',
  verification: 'ti-mail-forward',
  parametres: 'ti-settings',
};

const TYPE_LABELS: Record<ActivityVisualType, string> = {
  connexion: 'Connexion',
  creation: 'Création',
  modification: 'Modification',
  suppression: 'Suppression',
  erreur: 'Erreur',
  verification: 'Renvoi email de vérification',
  parametres: 'Paramètres',
};

export function resolveActivityTypeClass(type?: string): ActivityVisualType {
  const normalized = (type ?? '').trim().toUpperCase();
  return TYPE_ALIASES[normalized] ?? 'connexion';
}

export function resolveActivityTypeIcon(type?: string): string {
  return TYPE_ICONS[resolveActivityTypeClass(type)];
}

export function resolveActivityTypeLabel(type?: string): string {
  return TYPE_LABELS[resolveActivityTypeClass(type)];
}