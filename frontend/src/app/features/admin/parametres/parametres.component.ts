import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, NgForm } from '@angular/forms';
import { AdminSidebarComponent } from '../shared/admin-sidebar.component';

export type ParamTab = 'general' | 'affectations' | 'notifications' | 'securite' | 'api' | 'sante' | 'export';

export interface GeneralSettings {
  nomPlateforme:    string;
  urlPlateforme:    string;
  langue:           string;
  fuseau:           string;
  couleurPrimaire:  string;
  couleurAccent:    string;
  logoUrl:          string;
  modeMaintenance:  boolean;
  messageMainten:   string;
}

export interface AffectationSettings {
  seuilCompatibilite: number;
  nbProfilsMax:       number;
  matchingAuto:       boolean;
  rechercheGlobale:   boolean;
  delaiRelance:       number;
  alerteRetard:       number;
  prioriteDefaut:     string;
  poidsCompetences:   number;
  poidsDisponibilite: number;
  poidsExperience:    number;
}

export interface NotifSettings {
  alertesCritiques:   boolean;
  alertesVigilance:   boolean;
  alertesInfo:        boolean;
  notifEmail:         boolean;
  notifInApp:         boolean;
  emailDest:          string;
  heureResume:        string;
  frequenceResume:    string;
  notifNouvelUser:    boolean;
  notifAffectation:   boolean;
  notifEcheance:      boolean;
  joursAvantEcheance: number;
}

export interface SecuriteSettings {
  doubleAuth:          boolean;
  dureeSession:        number;
  tentativesMax:       number;
  dureeVerrouillage:   number;
  complexiteMdp:       boolean;
  longueurMinMdp:      number;
  expirMdp:            number;
  journalConnexion:    boolean;
  whitelistIp:         boolean;
  ipAutorisees:        string;
}

export interface ApiSettings {
  apiActive:      boolean;
  cleApi:         string;
  webhookUrl:     string;
  webhookSecret:  string;
  rateLimitRpm:   number;
  corsOrigins:    string;
  versionApi:     string;
  logsApi:        boolean;
}

export interface SanteSettings {
  monitoringActif:   boolean;
  alerteMemoire:     number;
  alerteCpu:         number;
  alerteDisque:      number;
  emailAlerteInfra:  string;
  sauvegardeAuto:    boolean;
  frequenceSauveg:   string;
  retentionJours:    number;
  purgeLogsJours:    number;
}

export interface ExportSettings {
  formatDefaut:     string;
  encodage:         string;
  separateurCsv:    string;
  includeHeaders:   boolean;
  exportCompresse:  boolean;
  maxLignes:        number;
  filigrane:        boolean;
  texteFiligrane:   string;
  logoInPdf:        boolean;
  piedPagePdf:      string;
}

const DEFAULT_GENERAL: GeneralSettings = {
  nomPlateforme:   'SmartAssign',
  urlPlateforme:   'https://smartassign.tn',
  langue:          'fr',
  fuseau:          'Africa/Tunis',
  couleurPrimaire: '#2563eb',
  couleurAccent:   '#10b981',
  logoUrl:         '',
  modeMaintenance: false,
  messageMainten:  'Plateforme en maintenance. Retour prévu dans 30 minutes.',
};

const DEFAULT_AFFECT: AffectationSettings = {
  seuilCompatibilite: 75,
  nbProfilsMax:       5,
  matchingAuto:       true,
  rechercheGlobale:   true,
  delaiRelance:       7,
  alerteRetard:       3,
  prioriteDefaut:     'NORMALE',
  poidsCompetences:   50,
  poidsDisponibilite: 30,
  poidsExperience:    20,
};

const DEFAULT_NOTIF: NotifSettings = {
  alertesCritiques:   true,
  alertesVigilance:   true,
  alertesInfo:        false,
  notifEmail:         false,
  notifInApp:         true,
  emailDest:          'admin@smartassign.tn',
  heureResume:        '08:00',
  frequenceResume:    'quotidien',
  notifNouvelUser:    true,
  notifAffectation:   true,
  notifEcheance:      true,
  joursAvantEcheance: 5,
};

const DEFAULT_SECU: SecuriteSettings = {
  doubleAuth:          false,
  dureeSession:        60,
  tentativesMax:       3,
  dureeVerrouillage:   30,
  complexiteMdp:       true,
  longueurMinMdp:      8,
  expirMdp:            90,
  journalConnexion:    true,
  whitelistIp:         false,
  ipAutorisees:        '',
};

const DEFAULT_API: ApiSettings = {
  apiActive:     true,
  cleApi:        'sk-sa-••••••••••••••••••••••••••••••••',
  webhookUrl:    '',
  webhookSecret: '',
  rateLimitRpm:  120,
  corsOrigins:   '*',
  versionApi:    'v1',
  logsApi:       true,
};

const DEFAULT_SANTE: SanteSettings = {
  monitoringActif:  true,
  alerteMemoire:    85,
  alerteCpu:        80,
  alerteDisque:     90,
  emailAlerteInfra: 'infra@smartassign.tn',
  sauvegardeAuto:   true,
  frequenceSauveg:  'quotidien',
  retentionJours:   30,
  purgeLogsJours:   90,
};

const DEFAULT_EXPORT: ExportSettings = {
  formatDefaut:    'xlsx',
  encodage:        'UTF-8',
  separateurCsv:   ';',
  includeHeaders:  true,
  exportCompresse: false,
  maxLignes:       10000,
  filigrane:       false,
  texteFiligrane:  'CONFIDENTIEL – SmartAssign',
  logoInPdf:       true,
  piedPagePdf:     'SmartAssign © 2026 – Export confidentiel',
};

@Component({
  selector: 'app-admin-parametres',
  standalone: true,
  imports: [CommonModule, FormsModule, AdminSidebarComponent],
  templateUrl: './parametres.component.html',
  styleUrls: ['./parametres.component.scss'],
})
export class AdminParametresComponent implements OnInit {
  currentDate = new Date();

  activeTab: ParamTab = 'general';

  tabs: { id: ParamTab; label: string; icon: string }[] = [
    { id: 'general',       label: 'Général',       icon: 'gear'   },
    { id: 'affectations',  label: 'Affectations',  icon: 'assign' },
    { id: 'notifications', label: 'Notifications', icon: 'bell'   },
    { id: 'securite',      label: 'Sécurité',      icon: 'shield' },
    { id: 'api',           label: 'API & Intégr.', icon: 'api'    },
    { id: 'sante',         label: 'Santé système', icon: 'health' },
    { id: 'export',        label: 'Export',        icon: 'export' },
  ];

  general:      GeneralSettings       = { ...DEFAULT_GENERAL };
  affectations: AffectationSettings   = { ...DEFAULT_AFFECT  };
  notif:        NotifSettings         = { ...DEFAULT_NOTIF   };
  securite:     SecuriteSettings      = { ...DEFAULT_SECU    };
  api:          ApiSettings           = { ...DEFAULT_API     };
  sante:        SanteSettings         = { ...DEFAULT_SANTE   };
  exportCfg:    ExportSettings        = { ...DEFAULT_EXPORT  };

  // Toast
  toast: { visible: boolean; type: 'success' | 'error'; message: string } = {
    visible: false, type: 'success', message: ''
  };
  private toastTimer?: ReturnType<typeof setTimeout>;

  // API key visibility
  apiKeyVisible = false;

  // Unsaved changes tracking
  unsaved: Record<ParamTab, boolean> = {
    general: false, affectations: false, notifications: false,
    securite: false, api: false, sante: false, export: false,
  };

  // Validation errors
  errors: Record<string, string> = {};

  constructor(private readonly cdr: ChangeDetectorRef) {}

  ngOnInit(): void {
    const saved = localStorage.getItem('smartassign_settings_v2');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.general)      this.general      = { ...DEFAULT_GENERAL, ...parsed.general };
        if (parsed.affectations) this.affectations = { ...DEFAULT_AFFECT,  ...parsed.affectations };
        if (parsed.notif)        this.notif        = { ...DEFAULT_NOTIF,   ...parsed.notif };
        if (parsed.securite)     this.securite     = { ...DEFAULT_SECU,    ...parsed.securite };
        if (parsed.api)          this.api          = { ...DEFAULT_API,     ...parsed.api };
        if (parsed.sante)        this.sante        = { ...DEFAULT_SANTE,   ...parsed.sante };
        if (parsed.exportCfg)    this.exportCfg    = { ...DEFAULT_EXPORT,  ...parsed.exportCfg };
      } catch { /* ignore */ }
    }
  }

  setTab(tab: ParamTab): void {
    this.activeTab = tab;
    this.errors = {};
  }

  markUnsaved(): void {
    this.unsaved[this.activeTab] = true;
  }

  // ── Validation ────────────────────────────────────────────
  private validate(): boolean {
    this.errors = {};
    const t = this.activeTab;

    if (t === 'general') {
      if (!this.general.nomPlateforme.trim())
        this.errors['nomPlateforme'] = 'Le nom est requis.';
      if (this.general.urlPlateforme && !/^https?:\/\/.+/.test(this.general.urlPlateforme))
        this.errors['urlPlateforme'] = 'URL invalide (doit commencer par http:// ou https://).';
      if (this.general.modeMaintenance && !this.general.messageMainten.trim())
        this.errors['messageMainten'] = 'Un message de maintenance est requis.';
    }

    if (t === 'affectations') {
      if (this.affectations.seuilCompatibilite < 0 || this.affectations.seuilCompatibilite > 100)
        this.errors['seuilCompatibilite'] = 'Valeur entre 0 et 100.';
      if (this.affectations.nbProfilsMax < 1 || this.affectations.nbProfilsMax > 20)
        this.errors['nbProfilsMax'] = 'Valeur entre 1 et 20.';
      const total = this.affectations.poidsCompetences + this.affectations.poidsDisponibilite + this.affectations.poidsExperience;
      if (total !== 100)
        this.errors['poids'] = `La somme des poids doit être 100 (actuellement ${total}).`;
    }

    if (t === 'notifications') {
      if (this.notif.notifEmail && !this.notif.emailDest.trim())
        this.errors['emailDest'] = 'Email destinataire requis si les notifications email sont activées.';
      if (this.notif.emailDest && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(this.notif.emailDest))
        this.errors['emailDest'] = 'Adresse email invalide.';
      if (this.notif.joursAvantEcheance < 1 || this.notif.joursAvantEcheance > 30)
        this.errors['joursAvantEcheance'] = 'Valeur entre 1 et 30 jours.';
    }

    if (t === 'securite') {
      if (this.securite.dureeSession < 5 || this.securite.dureeSession > 480)
        this.errors['dureeSession'] = 'Durée entre 5 et 480 minutes.';
      if (this.securite.longueurMinMdp < 6 || this.securite.longueurMinMdp > 32)
        this.errors['longueurMinMdp'] = 'Longueur entre 6 et 32 caractères.';
      if (this.securite.whitelistIp && !this.securite.ipAutorisees.trim())
        this.errors['ipAutorisees'] = 'Entrez au moins une adresse IP autorisée.';
    }

    if (t === 'api') {
      if (this.api.webhookUrl && !/^https?:\/\/.+/.test(this.api.webhookUrl))
        this.errors['webhookUrl'] = 'URL webhook invalide.';
      if (this.api.rateLimitRpm < 1 || this.api.rateLimitRpm > 10000)
        this.errors['rateLimitRpm'] = 'Valeur entre 1 et 10 000 req/min.';
    }

    if (t === 'sante') {
      if (this.sante.emailAlerteInfra && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(this.sante.emailAlerteInfra))
        this.errors['emailAlerteInfra'] = 'Adresse email invalide.';
      if (this.sante.retentionJours < 1)
        this.errors['retentionJours'] = 'Valeur positive requise.';
    }

    if (t === 'export') {
      if (this.exportCfg.maxLignes < 100 || this.exportCfg.maxLignes > 100000)
        this.errors['maxLignes'] = 'Valeur entre 100 et 100 000.';
      if (this.exportCfg.filigrane && !this.exportCfg.texteFiligrane.trim())
        this.errors['texteFiligrane'] = 'Texte du filigrane requis.';
    }

    return Object.keys(this.errors).length === 0;
  }

  // ── Save / Reset ──────────────────────────────────────────
  sauvegarder(): void {
    if (!this.validate()) {
      this.showToast('error', 'Veuillez corriger les erreurs avant de sauvegarder.');
      return;
    }
    const data = {
      general: this.general,
      affectations: this.affectations,
      notif: this.notif,
      securite: this.securite,
      api: this.api,
      sante: this.sante,
      exportCfg: this.exportCfg,
    };
    localStorage.setItem('smartassign_settings_v2', JSON.stringify(data));
    this.unsaved[this.activeTab] = false;
    this.showToast('success', 'Paramètres sauvegardés avec succès.');
  }

  appliquer(): void {
    if (!this.validate()) {
      this.showToast('error', 'Veuillez corriger les erreurs avant d\'appliquer.');
      return;
    }
    this.unsaved[this.activeTab] = false;
    this.showToast('success', 'Paramètres appliqués (non persistés). Cliquez sur "Sauvegarder" pour persister.');
  }

  reinitialiserOnglet(): void {
    const map: Record<ParamTab, () => void> = {
      general:       () => { this.general      = { ...DEFAULT_GENERAL }; },
      affectations:  () => { this.affectations = { ...DEFAULT_AFFECT  }; },
      notifications: () => { this.notif        = { ...DEFAULT_NOTIF   }; },
      securite:      () => { this.securite     = { ...DEFAULT_SECU    }; },
      api:           () => { this.api          = { ...DEFAULT_API     }; },
      sante:         () => { this.sante        = { ...DEFAULT_SANTE   }; },
      export:        () => { this.exportCfg    = { ...DEFAULT_EXPORT  }; },
    };
    map[this.activeTab]();
    this.errors = {};
    this.unsaved[this.activeTab] = false;
    this.showToast('success', 'Paramètres réinitialisés aux valeurs par défaut.');
  }

  // ── API key helpers ───────────────────────────────────────
  toggleApiKeyVisibility(): void {
    this.apiKeyVisible = !this.apiKeyVisible;
  }

  regenererCleApi(): void {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let key = 'sk-sa-';
    for (let i = 0; i < 32; i++) {
      key += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    this.api.cleApi = key;
    this.markUnsaved();
    this.showToast('success', 'Nouvelle clé API générée. Pensez à sauvegarder.');
  }

  // ── Poids auto-balance ────────────────────────────────────
  adjustPoids(changed: 'competences' | 'disponibilite' | 'experience'): void {
    const a = this.affectations;
    if (changed === 'competences') {
      const rem = 100 - a.poidsCompetences;
      const ratio = a.poidsDisponibilite / (a.poidsDisponibilite + a.poidsExperience) || 0.5;
      a.poidsDisponibilite = Math.round(rem * ratio);
      a.poidsExperience    = 100 - a.poidsCompetences - a.poidsDisponibilite;
    } else if (changed === 'disponibilite') {
      const rem = 100 - a.poidsDisponibilite;
      const ratio = a.poidsCompetences / (a.poidsCompetences + a.poidsExperience) || 0.7;
      a.poidsCompetences = Math.round(rem * ratio);
      a.poidsExperience  = 100 - a.poidsDisponibilite - a.poidsCompetences;
    } else {
      const rem = 100 - a.poidsExperience;
      const ratio = a.poidsCompetences / (a.poidsCompetences + a.poidsDisponibilite) || 0.6;
      a.poidsCompetences   = Math.round(rem * ratio);
      a.poidsDisponibilite = 100 - a.poidsExperience - a.poidsCompetences;
    }
    this.markUnsaved();
  }

  get poidsTotal(): number {
    return this.affectations.poidsCompetences +
           this.affectations.poidsDisponibilite +
           this.affectations.poidsExperience;
  }

  // ── Toast ─────────────────────────────────────────────────
  private showToast(type: 'success' | 'error', message: string): void {
    if (this.toastTimer) clearTimeout(this.toastTimer);
    this.toast = { visible: true, type, message };
    this.cdr.detectChanges();
    this.toastTimer = setTimeout(() => {
      this.toast.visible = false;
      this.cdr.detectChanges();
    }, 3500);
  }

  hasErrors(): boolean { return Object.keys(this.errors).length > 0; }

  reinitialiserTout(): void {
    this.general      = { ...DEFAULT_GENERAL };
    this.affectations = { ...DEFAULT_AFFECT  };
    this.notif        = { ...DEFAULT_NOTIF   };
    this.securite     = { ...DEFAULT_SECU    };
    this.errors = {};
    Object.keys(this.unsaved).forEach(k => (this.unsaved[k as ParamTab] = false));
    this.showToast('success', 'Tous les paramètres réinitialisés aux valeurs par défaut.');
  }

  exporterCSV(): void {
    const rows = [
      ['Paramètre', 'Valeur'],
      ['Seuil compatibilité', this.affectations.seuilCompatibilite + '%'],
      ['Profils max recommandés', String(this.affectations.nbProfilsMax)],
      ['Matching automatique', this.affectations.matchingAuto ? 'Oui' : 'Non'],
      ['Nom plateforme', this.general.nomPlateforme],
      ['Mode maintenance', this.general.modeMaintenance ? 'Activé' : 'Désactivé'],
      ['Durée session (min)', String(this.securite.dureeSession)],
      ['Double auth (2FA)', this.securite.doubleAuth ? 'Activé' : 'Désactivé'],
      ['Alertes critiques', this.notif.alertesCritiques ? 'Oui' : 'Non'],
      ['Alertes vigilance', this.notif.alertesVigilance ? 'Oui' : 'Non'],
      ['Notifications email', this.notif.notifEmail ? 'Oui' : 'Non'],
    ];
    const csv = rows.map(r => r.map(v => `"${v}"`).join(';')).join('\r\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'parametres-smartassign.csv'; a.click();
    URL.revokeObjectURL(url);
  }

  exporterPDF(): void { window.print(); }
}
