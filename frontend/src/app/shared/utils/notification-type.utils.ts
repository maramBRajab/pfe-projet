export function formatNotificationType(type: string): string {
  const map: { [key: string]: string } = {
    CONNEXION: 'Connexion détectée',
    MODIFICATION_PROFIL: 'Profil mis à jour',
    MISE_A_JOUR_PROFIL: 'Profil mis à jour',
    AFFECTATION: 'Nouvelle affectation',
    ALERTE: 'Alerte système',
    INFO: 'Information'
  };
  return map[type] || type;
}
