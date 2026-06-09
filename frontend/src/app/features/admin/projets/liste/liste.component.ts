import { Component, OnInit, ChangeDetectorRef, ElementRef, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { AuthService } from '../../../../services/auth';
import { AdminProjetService, Projet } from '../../../../services/admin';
import { AdminSidebarComponent } from '../../shared/admin-sidebar.component';
import { AdminTopbarComponent } from '../../shared/admin-topbar.component';

import { KpiCardComponent } from '../../../../shared/kpi-card/kpi-card.component';
@Component({
  selector: 'app-liste-projets',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, KpiCardComponent, AdminSidebarComponent, AdminTopbarComponent],
  templateUrl: './liste.component.html',
  styleUrls: ['./liste.component.scss']
})
export class ListeProjetsComponent implements OnInit {

  projets: Projet[] = [];

  currentDate = new Date();
  currentPage  = 1;
  pageSize     = 10;

  searchTerm = '';
  statutFilter = 'all';
  isLoading = false;
  errorMessage = '';
  userMenuOpen = false;

  // ── Modals ──────────────────────────────────────────────────
  viewedProjet: Projet | null = null;
  deleteTargetId: number | null = null;
  deleteTargetName = '';
  isDeleting = false;
  toastMessage = '';
  adminPhoto: string | null = null;
  private toastTimer?: ReturnType<typeof setTimeout>;

  constructor(
    private readonly authService: AuthService,
    private readonly adminProjetService: AdminProjetService,
    private readonly cdr: ChangeDetectorRef,
    private readonly router: Router,
    private readonly route: ActivatedRoute,
    private readonly elRef: ElementRef
  ) {}

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (!this.elRef.nativeElement.contains(event.target)) {
      this.userMenuOpen = false;
    }
  }

  toggleUserMenu(): void { this.userMenuOpen = !this.userMenuOpen; }

  navigateTo(path: string): void {
    this.userMenuOpen = false;
    void this.router.navigate([path]);
  }

  logout(): void {
    this.authService.logout();
    void this.router.navigate(['/login']);
  }

  ngOnInit(): void {
    this.adminPhoto = this.authService.currentUser?.photoUrl ?? null;
    this.applyStatutFromRoute(this.route.snapshot.queryParamMap.get('statut'));
    this.route.queryParamMap.subscribe((params) => {
      this.applyStatutFromRoute(params.get('statut'));
      this.currentPage = 1;
    });
    this.charger();
  }

  private applyStatutFromRoute(statut: string | null): void {
    const allowed = new Set(['all', 'en_cours', 'en_attente', 'termine', 'en_retard']);
    const normalized = (statut ?? '')
      .trim()
      .toLowerCase()
      .replace(/-/g, '_');

    if (normalized && allowed.has(normalized)) {
      this.statutFilter = normalized;
    }
  }

  charger(): void {
    this.isLoading    = true;
    this.errorMessage = '';
    this.adminProjetService.getAll().subscribe({
      next: data => {
        this.projets   = data;
        this.isLoading = false;
        this.cdr.detectChanges();
      },
      error: (err: HttpErrorResponse) => {
        if (err.status === 0) {
          this.errorMessage = 'Serveur indisponible. Vérifiez que le backend est démarré.';
        } else if (err.status === 401) {
          this.errorMessage = 'Session expirée. Veuillez vous reconnecter.';
        } else if (err.status === 403) {
          this.errorMessage = 'Accès refusé. Droits administrateur requis.';
        } else {
          this.errorMessage = `Erreur ${err.status} : impossible de charger les projets.`;
        }
        this.isLoading = false;
        this.cdr.detectChanges();
      }
    });
  }

  // ── View modal ───────────────────────────────────────────────
  openViewModal(p: Projet): void  { this.viewedProjet = p; }
  closeViewModal(): void          { this.viewedProjet = null; }

  // ── Delete modal ─────────────────────────────────────────────
  openDeleteModal(id: number, nom: string): void {
    this.deleteTargetId   = id;
    this.deleteTargetName = nom;
  }

  closeDeleteModal(): void {
    this.deleteTargetId   = null;
    this.deleteTargetName = '';
  }

  confirmerSuppression(): void {
    if (!this.deleteTargetId || this.isDeleting) return;
    this.isDeleting = true;
    this.adminProjetService.delete(this.deleteTargetId).subscribe({
      next: () => {
        this.projets = this.projets.filter(p => p.id !== this.deleteTargetId);
        this.showToast('Projet supprimé avec succès.');
        this.closeDeleteModal();
        this.isDeleting = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.errorMessage = 'La suppression a échoué.';
        this.isDeleting = false;
        this.closeDeleteModal();
        this.cdr.detectChanges();
      }
    });
  }

  private showToast(msg: string): void {
    if (this.toastTimer) clearTimeout(this.toastTimer);
    this.toastMessage = msg;
    this.toastTimer = setTimeout(() => {
      this.toastMessage = '';
      this.cdr.detectChanges();
    }, 3000);
  }

  // ── Helpers ──────────────────────────────────────────────────
  clearFilters(): void {
    this.statutFilter = 'all';
    this.currentPage = 1;
    this.searchTerm  = '';
  }

  goToPage(page: number): void {
    if (page >= 1 && page <= this.totalPages) this.currentPage = page;
  }

  min(a: number, b: number): number { return Math.min(a, b); }

  dureeJours(p: Projet): number {
    if (!p.dateDebut || !p.dateFin) return 0;
    const ms = new Date(p.dateFin).getTime() - new Date(p.dateDebut).getTime();
    return Math.max(0, Math.round(ms / 86_400_000) + 1);
  }

  competenceLabels(p: Projet): string[] {
    return (p.competencesRequises ?? [])
      .map(c => c?.nom?.trim() ?? '')
      .filter((label) => label.length > 0);
  }

  managerDisplayName(p: Projet): string {
    const managerName = (p.managerNom ?? '').trim();
    return managerName || 'Manager non affecté';
  }

  requiredSkillsText(p: Projet): string {
    const labels = this.competenceLabels(p);
    return labels.length ? labels.join(', ') : 'Aucune compétence définie';
  }

  projectProgression(p: Projet): number {
    if (typeof p.progression === 'number' && Number.isFinite(p.progression)) {
      return Math.max(0, Math.min(100, Math.round(p.progression)));
    }
    return this.coherentStatutKey(p) === 'termine' ? 100 : 0;
  }

  affectedCollaboratorsCount(p: Projet): number {
    return typeof p.nombreCollabs === 'number' && Number.isFinite(p.nombreCollabs)
      ? Math.max(0, Math.round(p.nombreCollabs))
      : 0;
  }

  affectedCollaboratorsLabel(p: Projet): string {
    const count = this.affectedCollaboratorsCount(p);
    return `${count} collaborateur${count > 1 ? 's' : ''}`;
  }

  formatProjectDate(value: string | undefined): string {
    if (!value) {
      return 'Date non définie';
    }
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return 'Date non définie';
    }
    return date.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
  }

  projectStatusHint(p: Projet): string {
    const declared = this.normalizeStatut(p.statut);
    const dateBased = this.statusFromDates(p);
    const coherent = this.coherentStatutKey(p);

    if (declared === 'termine' && dateBased !== 'termine') {
      return 'Terminé déclaré: justification métier requise';
    }

    if (declared !== coherent) {
      return `Statut affiché selon les dates: ${this.statutLabel(coherent)}`;
    }

    return '';
  }

  managerInitiales(name: string | undefined): string {
    const parts = (name ?? '').split(/\s+/).filter(Boolean);
    return parts.slice(0, 2).map((part) => part[0]?.toUpperCase() ?? '').join('') || 'MG';
  }

  get paginatedProjets(): Projet[] {
    const start = (this.currentPage - 1) * this.pageSize;
    return this.filteredProjets.slice(start, start + this.pageSize);
  }

  get totalPages(): number {
    return Math.max(1, Math.ceil(this.filteredProjets.length / this.pageSize));
  }

  get pageNumbers(): number[] {
    return Array.from({ length: this.totalPages }, (_, i) => i + 1);
  }

  get filteredProjets(): Projet[] {
    return this.projets.filter(p => {
      const matchSearch = p.nom.toLowerCase().includes(this.searchTerm.toLowerCase());
      const matchStatut = this.statutFilter === 'all'
        || this.coherentStatutKey(p) === this.statutFilter.toLowerCase();
      return matchSearch && matchStatut;
    });
  }

  statutLabel(statut: string): string {
    const map: Record<string, string> = {
      en_attente: 'En attente', EN_ATTENTE: 'En attente',
      en_cours:   'En cours',   EN_COURS:   'En cours',
      en_retard:  'En retard',  EN_RETARD:  'En retard',
      termine:    'Terminé',    TERMINE:    'Terminé',
    };
    return map[statut] ?? statut;
  }

  statutLabelProjet(projet: Projet): string {
    return this.statutLabel(this.coherentStatutKey(projet));
  }

  countStatut(s: string): number {
    return this.projets.filter(p =>
      this.coherentStatutKey(p) === s.toLowerCase()
    ).length;
  }

  get terminesCount():      number { return this.countStatut('termine'); }
  get enAttenteCount():     number { return this.countStatut('en_attente'); }
  get projetsActifsCount(): number { return this.countStatut('en_cours'); }
  get enRetardCount():      number { return this.countStatut('en_retard'); }

  get tauxCompletion(): number {
    if (!this.projets.length) return 0;
    return Math.round((this.terminesCount / this.projets.length) * 100);
  }

  statutShare(count: number): number {
    if (!this.projets.length) return 0;
    return Math.round((count / this.projets.length) * 100);
  }

  statutBadgeClass(statut: string): string {
    const s = this.normalizeStatut(statut);
    if (s === 'en_cours')   return 'badge-blue';
    if (s === 'termine')    return 'badge-green';
    if (s === 'en_retard')  return 'badge-red';
    return 'badge-amber';
  }

  statutBadgeClassProjet(projet: Projet): string {
    return this.statutBadgeClass(this.coherentStatutKey(projet));
  }

  avatarClassProjet(statut: string): string {
    const s = this.normalizeStatut(statut);
    if (s === 'en_cours')   return 'avatar-blue';
    if (s === 'termine')    return 'avatar-green';
    if (s === 'en_retard')  return 'avatar-red';
    return 'avatar-amber';
  }

  avatarClassProjetData(projet: Projet): string {
    return this.avatarClassProjet(this.coherentStatutKey(projet));
  }

  initialesProjet(nom: string): string {
    return nom.split(/\s+/).filter(Boolean).slice(0, 2)
      .map(part => part[0]?.toUpperCase() ?? '').join('') || 'PR';
  }

  trackByProjet(_: number, projet: Projet): number | string {
    return projet.id ?? projet.nom;
  }

  exporterCSV(): void {
    const escape = (val: string) =>
      val.includes(',') || val.includes('"') || val.includes('\n')
        ? `"${val.replace(/"/g, '""')}"`
        : val;

    const formatDate = (d: string | undefined) =>
      d ? new Date(d).toLocaleDateString('fr-FR') : '';

    const header = 'Nom,Date début,Date fin,Durée (jours),Compétences requises,Statut';
    const rows = this.filteredProjets.map(p =>
      [
        escape(p.nom),
        formatDate(p.dateDebut),
        formatDate(p.dateFin),
        String(this.dureeJours(p)),
        escape(this.competenceLabels(p).join('; ')),
        escape(this.statutLabel(p.statut))
      ].join(',')
    );

    const csv  = [header, ...rows].join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = 'projets.csv';
    a.click();
    URL.revokeObjectURL(url);
  }

  exportPdf(): void {
    const win = window.open('', '_blank', 'width=1100,height=760');
    if (!win) return;

    const rows = this.filteredProjets.map(p => `
      <tr>
        <td>${p.nom}</td>
        <td>${this.managerDisplayName(p)}</td>
        <td>${this.formatProjectDate(p.dateDebut)}</td>
        <td>${this.formatProjectDate(p.dateFin)}</td>
        <td>${this.statutLabelProjet(p)}</td>
      </tr>`).join('');

    win.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8">
      <title>Projets — SmartAssign</title>
      <style>
        body { font-family: 'DM Sans', Arial, sans-serif; font-size: 12px; color: #1e293b; padding: 24px; }
        h1 { font-size: 20px; margin: 0 0 6px; }
        p { color: #64748b; margin: 0 0 18px; }
        table { width: 100%; border-collapse: collapse; }
        th { background: #f8fafc; text-align: left; padding: 8px 10px; font-size: 10px; text-transform: uppercase; letter-spacing: .08em; border-bottom: 2px solid #e2e8f0; }
        td { padding: 8px 10px; border-bottom: 1px solid #e2e8f0; }
      </style></head><body>
      <h1>Gestion des projets — SmartAssign</h1>
      <p>Généré le ${new Date().toLocaleDateString('fr-FR')} · ${this.filteredProjets.length} projet(s)</p>
      <table>
        <thead><tr><th>Projet</th><th>Manager</th><th>Date début</th><th>Date fin</th><th>Statut</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
      </body></html>`);
    win.document.close();
    win.focus();
    win.print();
  }

  private coherentStatutKey(projet: Projet): 'en_attente' | 'en_cours' | 'en_retard' | 'termine' {
    const declared = this.normalizeStatut(projet.statut);
    if (declared === 'termine') {
      return 'termine';
    }

    return this.statusFromDates(projet);
  }

  private statusFromDates(projet: Projet): 'en_attente' | 'en_cours' | 'en_retard' | 'termine' {
    const declared = this.normalizeStatut(projet.statut);
    if (declared === 'termine') {
      return 'termine';
    }

    const start = this.parseDateSafe(projet.dateDebut);
    const end = this.parseDateSafe(projet.dateFin);
    if (!start || !end) {
      return declared === 'en_retard' ? 'en_retard' : 'en_attente';
    }

    const today = new Date();
    const current = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const startDay = new Date(start.getFullYear(), start.getMonth(), start.getDate());
    const endDay = new Date(end.getFullYear(), end.getMonth(), end.getDate());

    if (current < startDay) {
      return 'en_attente';
    }
    if (current > endDay) {
      return 'en_retard';
    }
    return 'en_cours';
  }

  private normalizeStatut(statut: string | undefined): 'en_attente' | 'en_cours' | 'en_retard' | 'termine' {
    const raw = (statut ?? '').trim().toLowerCase().replace('-', '_').replace(' ', '_');
    if (raw === 'en_cours') return 'en_cours';
    if (raw === 'en_retard') return 'en_retard';
    if (raw === 'termine' || raw === 'terminé') return 'termine';
    return 'en_attente';
  }

  private parseDateSafe(value: string | undefined): Date | null {
    if (!value) return null;
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
}
