export interface ProfileData {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  position: string;
  roleSpecificField: string;
  stats?: ProfileStat[];
  permissions?: ProfilePermission[];
}

export interface ProfileSaveValue {
  role: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  position: string;
  roleSpecificField: string;
}

export type ProfileFeedbackTone = 'success' | 'error' | 'warning' | 'neutral';

export interface ProfileStat {
  label: string;
  value: string;
}

export interface ProfilePermission {
  label: string;
  allowed: boolean;
}

export interface ProfileHighlightCard {
  label: string;
  value: string;
  hint: string;
}

export interface ProfileDetailItem {
  title: string;
  subtitle: string;
  meta: string;
  badge: string;
  tone?: string;
}

export interface ProfileDetailSection {
  kicker: string;
  title: string;
  emptyState: string;
  items: ProfileDetailItem[];
}
