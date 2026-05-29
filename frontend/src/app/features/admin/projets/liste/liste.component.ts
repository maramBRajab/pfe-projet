import { Component, OnInit, ChangeDetectorRef, ElementRef, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { Router } from '@angular/router';
import { AuthService } from '../../../../services/auth';
import { AdminProjetService, Projet } from '../../../../services/admin';
import { AdminSidebarComponent } from '../../shared/admin-sidebar.component';
import { FormulaireProjetComponent } from '../formulaire/formulaire.component';

@Component({
  selector: 'app-liste-projets',
  standalone: true,
  imports: [CommonModule, FormsModule, FormulaireProjetComponent, AdminSidebarComponent],
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
  isCreateModalOpen = false;
  userMenuOpen = false;

  // ── Modals ──────────────────────────────────────────────────
  viewedProjet: Projet | null = null;
  editedProjetId: number | null = null;
  deleteTargetId: number | null = null;
  deleteTargetName = '';
  isDeleting = false;
  toastMessage = '';
  private toastTimer?: ReturnType<typeof setTimeout>;

  constructor(
    private readonly authService: AuthService,
    private readonly adminProjetService: AdminProjetService,
    private readonly cdr: ChangeDetectorRef,
    private readonly router: Router,
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

  ngOnInit(): void { this.charger(); }

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

  editFromViewModal(): void {
    const id = this.viewedProjet?.id;
    if (id == null) return;
    this.viewedProjet  = null;
    this.editedProjetId = id;
  }

  // ── Edit modal ───────────────────────────────────────────────
  openEditModal(id: number): void  { this.editedProjetId = id; }
  closeEditModal(): void           { this.editedProjetId = null; }

  onEditSaved(projet: Projet): void {
    this.closeEditModal();
    this.charger();
    this.showToast('Projet mis à jour avec succès.');
  }

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

  // ── Create modal ─────────────────────────────────────────────
  openCreateModal():  void { this.isCreateModalOpen = true; }
  closeCreateModal(): void { this.isCreateModalOpen = false; }

  onProjetCreated(projet: Projet): void {
    this.closeCreateModal();
    this.charger();
  }

  // ── Helpers ──────────────────────────────────────────────────
  clearFilters(): void {
    this.searchTerm  = 'all';
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
    return (p.competencesRequises ?? []).map(c => c.nom);
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
      const matchStatut = this.statutFilter === 'all' || p.statut === this.statutFilter;
      return matchSearch && matchStatut;
    });
  }

  statutLabel(statut: string): string {
    const map: Record<string, string> = {
      en_attente: 'En attente', EN_ATTENTE: 'En attente',
      en_cours:   'En cours',   EN_COURS:   'En cours',
      termine:    'Terminé',    TERMINE:    'Terminé',
    };
    return map[statut] ?? statut;
  }

  countStatut(s: string): number {
    return this.projets.filter(p =>
      p.statut === s || p.statut === s.toUpperCase()
    ).length;
  }

  get terminesCount():      number { return this.countStatut('termine'); }
  get enAttenteCount():     number { return this.countStatut('en_attente'); }
  get projetsActifsCount(): number { return this.countStatut('en_cours'); }

  get tauxCompletion(): number {
    if (!this.projets.length) return 0;
    return Math.round((this.terminesCount / this.projets.length) * 100);
  }

  statutBadgeClass(statut: string): string {
    const s = (statut ?? '').toLowerCase();
    if (s === 'en_cours')   return 'badge-blue';
    if (s === 'termine')    return 'badge-green';
    return 'badge-amber';
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
}