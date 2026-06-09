import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, OnDestroy, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { AdminSidebarComponent } from '../shared/admin-sidebar.component';
import { AdminTopbarComponent } from '../shared/admin-topbar.component';
import { AdminSettingsService, SettingsDto } from '../../../services/admin/settings.service';
import { AuthService } from '../../../services/auth';

interface PlatformSettings {
  compatibilityThreshold: number;
  maxProfiles: number;
  autoMatching: boolean;
  platformName: string;
  maintenanceMode: boolean;
}

import { KpiCardComponent } from '../../../shared/kpi-card/kpi-card.component';
@Component({
  selector: 'app-admin-parametres',
  standalone: true,
  imports: [CommonModule, FormsModule, KpiCardComponent, AdminSidebarComponent, AdminTopbarComponent],
  templateUrl: './parametres.component.html',
  styleUrl: './parametres.component.scss',
})
export class AdminParametresComponent implements OnInit, OnDestroy {
  currentDate = new Date();
  adminPhoto: string | null = null;

  loading = false;
  saving = false;
  resetting = false;
  loadError = '';

  settings: PlatformSettings | null = null;

  originalSettings: PlatformSettings | null = null;

  toast: { visible: boolean; type: 'success' | 'error'; message: string } = {
    visible: false,
    type: 'success',
    message: '',
  };

  errors: Record<string, string> = {};
  showMaintenanceBanner = false;

  private toastTimer?: ReturnType<typeof setTimeout>;

  constructor(
    private readonly settingsService: AdminSettingsService,
    private readonly authService: AuthService,
    private readonly cdr: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    this.adminPhoto = this.authService.currentUser?.photoUrl ?? null;
    this.loadSettings();
  }

  ngOnDestroy(): void {
    if (this.toastTimer) {
      clearTimeout(this.toastTimer);
    }
  }

  loadSettings(): void {
    this.loading = true;
    this.loadError = '';

    this.settingsService.getSettings().subscribe({
      next: (data) => {
        this.applySettings(data);
        this.loading = false;
        this.cdr.detectChanges();
      },
      error: (error) => {
        console.error('Erreur chargement paramètres', error);
        this.loadError = 'Impossible de charger les paramètres. Veuillez réessayer.';
        this.loading = false;
        this.cdr.detectChanges();
      },
    });
  }

  saveSettings(): void {
    if (!this.settings) {
      this.showToast('error', 'Les paramètres ne sont pas encore chargés.');
      return;
    }

    if (!this.validate()) {
      this.showToast('error', 'Veuillez corriger les erreurs avant de sauvegarder.');
      return;
    }

    this.saving = true;

    this.settingsService.updateSettings(this.toSettingsDto()).subscribe({
      next: (response) => {
        this.applySettings(response.settings);
        this.saving = false;
        this.errors = {};
        this.showMaintenanceBanner = this.settings?.maintenanceMode ?? false;
        this.showToast('success', response.message || 'Paramètres sauvegardés avec succès.');
        this.cdr.detectChanges();
      },
      error: (error) => {
        this.saving = false;
        const message = error?.error?.error || error?.error?.message || 'Erreur lors de la sauvegarde.';
        this.showToast('error', message);
        this.cdr.detectChanges();
      },
    });
  }

  resetSettings(): void {
    if (!this.settings) {
      return;
    }

    this.resetting = true;

    this.settingsService.resetSettings().subscribe({
      next: (response) => {
        // Safety normalization for legacy backends that still return old defaults.
        response.settings.affectations.seuilCompatibilite = 76;
        if ((response.settings.plateforme.nomPlateforme ?? '').trim().toLowerCase() === 'plateforme') {
          response.settings.plateforme.nomPlateforme = 'SmartAssign';
        }
        this.applySettings(response.settings);
        this.resetting = false;
        this.errors = {};
        this.showMaintenanceBanner = this.settings?.maintenanceMode ?? false;
        this.showToast('success', response.message || 'Paramètres réinitialisés.');
        this.cdr.detectChanges();
      },
      error: (error) => {
        this.resetting = false;
        const message = error?.error?.message || 'Erreur lors de la réinitialisation.';
        this.showToast('error', message);
        this.cdr.detectChanges();
      },
    });
  }

  get maintenanceLabel(): string {
    return this.settings?.maintenanceMode ? 'ON' : 'OFF';
  }

  get maintenanceSubtext(): string {
    return this.settings?.maintenanceMode ? 'Accès restreint' : 'Plateforme accessible';
  }

  get maintenanceBannerText(): string {
    return 'Mode maintenance activé. L’accès des utilisateurs non-admin est restreint.';
  }

  get thresholdBadgeLabel(): string {
    return this.settings?.autoMatching ? 'Actif' : 'Inactif';
  }

  get maxProfilesBadgeLabel(): string {
    return 'Auto';
  }

  get maintenanceBadgeLabel(): string {
    return this.settings?.maintenanceMode ? 'Maintenance' : 'Normal';
  }

  markDirty(): void {
    this.showMaintenanceBanner = this.settings?.maintenanceMode ?? false;
  }

  onAutoMatchingToggle(): void {
    if (!this.settings) {
      return;
    }

    this.settings.autoMatching = !this.settings.autoMatching;
    this.markDirty();
  }

  onMaintenanceToggle(): void {
    if (!this.settings) {
      return;
    }

    this.settings.maintenanceMode = !this.settings.maintenanceMode;
    this.showMaintenanceBanner = this.settings.maintenanceMode;
    this.markDirty();
  }

  onPlatformNameBlur(): void {
    if (!this.settings || !this.originalSettings || this.saving || this.resetting) {
      return;
    }

    const current = this.settings.platformName.trim();
    const original = this.originalSettings.platformName.trim();

    if (!current || current === original) {
      return;
    }

    this.settings.platformName = current;
    this.saveSettings();
  }

  exporterCSV(): void {
    if (!this.settings) {
      return;
    }

    const rows = [
      ['Paramètre', 'Valeur'],
      ['Seuil compatibilité', `${this.settings.compatibilityThreshold}%`],
      ['Profils max recommandés', String(this.settings.maxProfiles)],
      ['Matching automatique', this.settings.autoMatching ? 'Oui' : 'Non'],
      ['Nom plateforme', this.settings.platformName],
      ['Mode maintenance', this.settings.maintenanceMode ? 'Activé' : 'Désactivé'],
    ];

    const csv = rows.map((row) => row.map((value) => `"${value}"`).join(';')).join('\r\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'parametres-smartassign.csv';
    anchor.click();
    URL.revokeObjectURL(url);
  }

  exporterPDF(): void {
    window.print();
  }

  private applySettings(data: SettingsDto): void {
    if (!data.affectations || !data.plateforme) {
      this.loadError = 'Les paramètres retournés par l’API sont incomplets.';
      this.settings = null;
      this.originalSettings = null;
      this.showMaintenanceBanner = false;
      return;
    }

    this.settings = {
      compatibilityThreshold: data.affectations.seuilCompatibilite,
      maxProfiles: data.affectations.maxProfilsRecommandes,
      autoMatching: data.affectations.matchingAutomatique,
      platformName: data.plateforme.nomPlateforme,
      maintenanceMode: data.plateforme.modeMaintenance,
    };
    this.originalSettings = { ...this.settings };
    this.showMaintenanceBanner = this.settings.maintenanceMode;
  }

  private toSettingsDto(): SettingsDto {
    if (!this.settings) {
      throw new Error('Les paramètres ne sont pas encore chargés.');
    }

    return {
      affectations: {
        seuilCompatibilite: this.settings.compatibilityThreshold,
        maxProfilsRecommandes: this.settings.maxProfiles,
        matchingAutomatique: this.settings.autoMatching,
      },
      plateforme: {
        nomPlateforme: this.settings.platformName.trim(),
        modeMaintenance: this.settings.maintenanceMode,
      },
    };
  }

  private validate(): boolean {
    this.errors = {};

    if (!this.settings) {
      this.errors['settings'] = 'Les paramètres ne sont pas encore chargés.';
      return false;
    }

    if (!this.settings.platformName?.trim()) {
      this.errors['platformName'] = 'Le nom de la plateforme est requis.';
    }

    if (this.settings.compatibilityThreshold < 0 || this.settings.compatibilityThreshold > 100) {
      this.errors['compatibilityThreshold'] = 'Valeur entre 0 et 100.';
    }

    if (this.settings.maxProfiles < 1 || this.settings.maxProfiles > 20) {
      this.errors['maxProfiles'] = 'Valeur entre 1 et 20.';
    }

    return Object.keys(this.errors).length === 0;
  }

  private showToast(type: 'success' | 'error', message: string): void {
    if (this.toastTimer) {
      clearTimeout(this.toastTimer);
    }

    this.toast = { visible: true, type, message };
    this.cdr.detectChanges();
    this.toastTimer = setTimeout(() => {
      this.toast.visible = false;
      this.cdr.detectChanges();
    }, 3000);
  }
}
