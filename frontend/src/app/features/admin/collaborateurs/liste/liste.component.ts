import { Component, OnInit, ChangeDetectorRef, ElementRef, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { Router } from '@angular/router';
import { AdminCollaborateurService, Collaborateur } from '../../../../services/admin';
import { AuthService } from '../../../../services/auth';
import { AdminSidebarComponent } from '../../shared/admin-sidebar.component';
import { FormulaireCollaborateurComponent } from '../formulaire/formulaire.component';

@Component({
  selector: 'app-liste-collaborateurs',
  standalone: true,
  imports: [CommonModule, FormsModule, FormulaireCollaborateurComponent, AdminSidebarComponent],
  templateUrl: './liste.component.html',
  styleUrl: './liste.component.scss'
})
export class ListeCollaborateursComponent implements OnInit {

  collaborateurs: Collaborateur[] = [];

  currentDate = new Date();
  currentPage  = 1;
  pageSize     = 10;

  searchTerm         = '';
  roleFilter:         'all' | 'ADMIN' | 'MANAGER' | 'COLLAB' = 'all';
  disponibiliteFilter: 'all' | 'actif' | 'suspendu' | 'inactif' = 'all';
  experienceFilter:  'all' | 'junior' | 'confirmed' | 'senior' = 'all';

  isLoading        = false;
  errorMessage     = '';
  isCreateModalOpen = false;
  userMenuOpen = false;

  // ── Create form ─────────────────────────────────────────────
  createForm = { prenom: '', nom: '', email: '', role: 'COLLAB' };
  createFormError = '';

  // ── Modals ──────────────────────────────────────────────────
  viewedCollaborateur: Collaborateur | null = null;
  editedCollaborateurId: number | null = null;
  deleteTargetId: number | null = null;
  deleteTargetName = '';
  isDeleting = false;

  // ── CSV modal ───────────────────────────────────────────────
  showCsvModal = false;
  csvDragging  = false;
  toastMessage = '';
  private toastTimer?: ReturnType<typeof setTimeout>;

  constructor(
    private adminCollaborateurService: AdminCollaborateurService,
    private cdr: ChangeDetectorRef,
    private authService: AuthService,
    private router: Router,
    private elRef: ElementRef
  ) {}

  ngOnInit(): void {
    this.charger();
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (!this.elRef.nativeElement.contains(event.target)) {
      this.userMenuOpen = false;
    }
  }

  toggleUserMenu(): void {
    this.userMenuOpen = !this.userMenuOpen;
  }

  navigateTo(path: string): void {
    this.userMenuOpen = false;
    void this.router.navigate([path]);
  }

  logout(): void {
    this.authService.logout();
    void this.router.navigate(['/login']);
  }

  get filteredCollaborateurs(): Collaborateur[] {
    const s = this.searchTerm.trim().toLowerCase();

    return this.collaborateurs.filter(c => {
      const name  = `${c.prenom} ${c.nom}`.toLowerCase();
      const email = c.email.toLowerCase();
      const comps = (c.competences ?? [])
        .map(cp => this.readCompetenceName(cp).toLowerCase())
        .join(' ');

      const matchSearch = !s || name.includes(s) || email.includes(s) || comps.includes(s);

      const matchDispo =
        this.disponibiliteFilter === 'all' ||
        (this.disponibiliteFilter === 'actif'    &&  c.disponible) ||
        (this.disponibiliteFilter === 'suspendu' && !c.disponible) ||
        (this.disponibiliteFilter === 'inactif'  && !c.disponible);

      const matchRole =
        this.roleFilter === 'all' ||
        this.normalizeRole(c.role) === this.roleFilter;

      const matchExp = this.matchesExperienceFilter(c.experienceAnnees);

      return matchSearch && matchDispo && matchRole && matchExp;
    });
  }

  get paginatedCollaborateurs(): Collaborateur[] {
    const start = (this.currentPage - 1) * this.pageSize;
    return this.filteredCollaborateurs.slice(start, start + this.pageSize);
  }

  get totalPages(): number {
    return Math.max(1, Math.ceil(this.filteredCollaborateurs.length / this.pageSize));
  }

  get pageNumbers(): number[] {
    return Array.from({ length: this.totalPages }, (_, i) => i + 1);
  }

  get disponiblesCount(): number {
    return this.collaborateurs.filter(c => c.disponible).length;
  }

  get occupesCount(): number {
    return this.collaborateurs.length - this.disponiblesCount;
  }

  get suspendusCount(): number {
    return 0; // no suspension feature in current data model
  }

  get totalCompetences(): number {
    return this.collaborateurs.reduce((t, c) => t + (c.competences?.length ?? 0), 0);
  }

  get moyenneExperience(): number {
    if (!this.collaborateurs.length) return 0;
    const total = this.collaborateurs.reduce((s, c) => s + c.experienceAnnees, 0);
    return Number((total / this.collaborateurs.length).toFixed(1));
  }

  // ── Actions ─────────────────────────────────────────────────────

  charger(): void {
    this.isLoading    = true;
    this.errorMessage = '';

    this.adminCollaborateurService.getAll().subscribe({
      next: data => {
        this.collaborateurs = data;
        this.isLoading      = false;
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
          this.errorMessage = `Erreur ${err.status} : impossible de charger les collaborateurs.`;
        }
        this.isLoading = false;
        this.cdr.detectChanges();
      }
    });
  }

  supprimer(id: number): void {
    const target = this.collaborateurs.find(c => c.id === id);
    this.deleteTargetId   = id;
    this.deleteTargetName = target ? `${target.prenom} ${target.nom}` : 'ce collaborateur';
  }

  closeDeleteModal(): void {
    if (this.isDeleting) return; // don't allow closing while a delete is in flight
    this.deleteTargetId   = null;
    this.deleteTargetName = '';
  }

  confirmerSuppression(): void {
    if (!this.deleteTargetId || this.isDeleting) return;
    this.isDeleting = true;
    const id = this.deleteTargetId; // capture before async — closeDeleteModal() may null it out

    this.adminCollaborateurService.delete(id).subscribe({
      next: () => {
        this.collaborateurs = this.collaborateurs.filter(c => c.id !== id);
        this.showToast(`Collaborateur supprimé avec succès.`);
        this.isDeleting = false;
        this.closeDeleteModal();
        this.cdr.detectChanges();
      },
      error: (err) => {
        const msg = (err?.error?.message as string | undefined) || 'La suppression a échoué.';
        this.errorMessage = msg;
        this.isDeleting = false;
        this.closeDeleteModal();
        this.cdr.detectChanges();
      }
    });
  }

  openViewModal(c: Collaborateur): void {
    this.viewedCollaborateur = c;
  }

  closeViewModal(): void {
    this.viewedCollaborateur = null;
  }

  /** Close view modal then open edit modal — captures ID before nulling viewedCollaborateur */
  editFromViewModal(): void {
    const id = this.viewedCollaborateur?.id;
    if (id == null) return;
    this.viewedCollaborateur = null;
    this.editedCollaborateurId = id;
  }

  openEditModal(id: number): void {
    this.editedCollaborateurId = id;
  }

  closeEditModal(): void {
    this.editedCollaborateurId = null;
  }

  onEditSaved(): void {
    const id = this.editedCollaborateurId; // capture before closing
    this.closeEditModal();
    this.showToast('Collaborateur mis à jour avec succès.');
    // Refresh only the modified row — avoids hiding the whole table via charger()
    if (id != null) {
      this.adminCollaborateurService.getById(id).subscribe({
        next: updated => {
          this.collaborateurs = this.collaborateurs.map(c => c.id === updated.id ? updated : c);
          this.cdr.detectChanges();
        },
        error: () => this.charger() // fallback to full reload if targeted fetch fails
      });
    } else {
      this.charger();
    }
  }

  private showToast(msg: string): void {
    if (this.toastTimer) clearTimeout(this.toastTimer);
    this.toastMessage = msg;
    this.toastTimer = setTimeout(() => {
      this.toastMessage = '';
      this.cdr.detectChanges();
    }, 3000);
  }

  toggleDisponibilite(collaborateur: Collaborateur): void {
    if (typeof collaborateur.id !== 'number') return;

    this.adminCollaborateurService.toggleDisponibilite(collaborateur.id).subscribe({
      next: updated => {
        this.collaborateurs = this.collaborateurs.map(item =>
          item.id === updated.id ? updated : item
        );
        this.cdr.detectChanges();
      },
      error: () => {
        this.errorMessage = 'La mise à jour de la disponibilité a échoué.';
        this.cdr.detectChanges();
      }
    });
  }

  clearFilters(): void {
    this.searchTerm          = '';
    this.roleFilter          = 'all';
    this.disponibiliteFilter = 'all';
    this.experienceFilter    = 'all';
    this.currentPage         = 1;
  }

  goToPage(page: number): void {
    if (page >= 1 && page <= this.totalPages) {
      this.currentPage = page;
    }
  }

  min(a: number, b: number): number { return Math.min(a, b); }

  openCreateModal(): void {
    this.errorMessage     = '';
    this.createFormError  = '';
    this.createForm       = { prenom: '', nom: '', email: '', role: 'COLLAB' };
    this.isCreateModalOpen = true;
  }

  closeCreateModal(): void {
    this.isCreateModalOpen = false;
    this.createFormError   = '';
  }

  submitCreateForm(): void {
    const { prenom, nom, email, role } = this.createForm;
    if (!prenom.trim() || !nom.trim() || !email.trim()) {
      this.createFormError = 'Veuillez remplir tous les champs obligatoires.';
      return;
    }
    this.createFormError = '';
    const payload = {
      prenom: prenom.trim(),
      nom: nom.trim(),
      email: email.trim(),
      role,
      experienceAnnees: 0,
      disponible: true,
      competenceIds: [] as number[]
    };
    this.adminCollaborateurService.create(payload).subscribe({
      next: () => {
        this.closeCreateModal();
        this.charger();
        this.showToast('Utilisateur créé avec succès');
      },
      error: (err: HttpErrorResponse) => {
        this.createFormError = err.status === 409
          ? 'Cet email est déjà utilisé.'
          : 'Erreur lors de la création.';
      }
    });
  }

  // ── Template helpers ────────────────────────────────────────────

  trackByCollaborateur(_: number, c: Collaborateur) {
    return c.id ?? c.email;
  }

  initiales(nom: string, prenom: string): string {
    return `${prenom?.[0] ?? ''}${nom?.[0] ?? ''}`.toUpperCase();
  }

  /** Couleur de l'avatar selon le rôle */
  avatarClass(role: string): string {
    switch (this.normalizeRole(role)) {
      case 'ADMIN':   return 'avatar-amber';
      case 'MANAGER': return 'avatar-cyan';
      default:        return '';            // bleu par défaut via CSS
    }
  }

  roleBadgeClass(role: string): string {
    switch (this.normalizeRole(role)) {
      case 'ADMIN':   return 'badge-violet';
      case 'MANAGER': return 'badge-blue';
      default:        return 'badge-slate';
    }
  }

  roleLabel(role: string): string {
    switch (this.normalizeRole(role)) {
      case 'ADMIN':   return 'Admin';
      case 'MANAGER': return 'Manager';
      default:        return 'Collaborateur';
    }
  }

  competenceLabels(collaborateur: Collaborateur): string[] {
    return (collaborateur.competences ?? [])
      .map(c => this.readCompetenceName(c))
      .filter(label => !!label);
  }

  // ── Private ─────────────────────────────────────────────────────

  private matchesExperienceFilter(exp: number): boolean {
    switch (this.experienceFilter) {
      case 'junior':    return exp < 3;
      case 'confirmed': return exp >= 3 && exp < 7;
      case 'senior':    return exp >= 7;
      default:          return true;
    }
  }

  private normalizeRole(role: string | undefined): 'ADMIN' | 'MANAGER' | 'COLLAB' {
    const r = (role ?? 'COLLAB').toUpperCase();
    if (r.includes('ADMIN'))                         return 'ADMIN';
    if (r.includes('MANAGER') || r.includes('CHEF')) return 'MANAGER';
    return 'COLLAB';
  }

  private readCompetenceName(c: unknown): string {
    if (typeof c === 'string') return c;
    if (typeof c === 'object' && c && 'nom' in c) {
      const { nom } = c as any;
      return typeof nom === 'string' ? nom : '';
    }
    return '';
  }

  openCsvModal():  void { this.showCsvModal = true; }
  closeCsvModal(): void { this.showCsvModal = false; this.csvDragging = false; }

  onCsvDragOver(e: DragEvent): void  { e.preventDefault(); this.csvDragging = true; }
  onCsvDragLeave(): void              { this.csvDragging = false; }
  onCsvDrop(e: DragEvent): void {
    e.preventDefault();
    this.csvDragging = false;
    const file = e.dataTransfer?.files?.[0];
    if (file) { this.handleCsvFile(file); }
  }
  onCsvFileChange(e: Event): void {
    const input = e.target as HTMLInputElement;
    if (input.files?.[0]) { this.handleCsvFile(input.files[0]); input.value = ''; }
  }
  private handleCsvFile(file: File): void {
    const reader = new FileReader();
    reader.onload = () => { this.charger(); };
    reader.readAsText(file, 'utf-8');
    this.closeCsvModal();
  }

  importerCSV(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (!input.files?.length) return;
    const file = input.files[0];
    const reader = new FileReader();
    reader.onload = () => {
      // CSV imported — refresh list to reflect any server-side processing
      this.charger();
    };
    reader.readAsText(file, 'utf-8');
    // Reset so the same file can be re-selected
    input.value = '';
  }

  exporterCSV(): void {
    const escape = (val: string) =>
      val.includes(',') || val.includes('"') || val.includes('\n')
        ? `"${val.replace(/"/g, '""')}"`
        : val;

    const header = 'Nom,Email,Rôle,Expérience (ans),Disponibilité';
    const rows = this.filteredCollaborateurs.map(c =>
      [
        escape(`${c.prenom} ${c.nom}`),
        escape(c.email),
        escape(this.roleLabel(c.role)),
        String(c.experienceAnnees),
        c.disponible ? 'Disponible' : 'Occupé'
      ].join(',')
    );

    const csv = [header, ...rows].join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = 'utilisateurs.csv';
    a.click();
    URL.revokeObjectURL(url);
    this.showToast('Export CSV téléchargé.');
  }

  exportPdf(): void {
    const win = window.open('', '_blank', 'width=1000,height=700');
    if (!win) return;
    const rows = this.filteredCollaborateurs.map(c => `
      <tr>
        <td>${c.prenom} ${c.nom}</td>
        <td>${c.email}</td>
        <td>${this.roleLabel(c.role)}</td>
        <td>${c.experienceAnnees} an(s)</td>
        <td><span class="badge badge--${c.disponible ? 'ok' : 'busy'}">${c.disponible ? 'Disponible' : 'Occupé'}</span></td>
      </tr>`).join('');
    win.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8">
      <title>Collaborateurs — SmartAssign</title>
      <style>
        body { font-family: Inter, sans-serif; font-size: 12px; color: #1e293b; padding: 24px; }
        h1   { font-size: 18px; margin-bottom: 4px; }
        p    { color: #64748b; margin-bottom: 16px; font-size: 12px; }
        table{ width: 100%; border-collapse: collapse; }
        th   { background: #f5f7fb; text-align: left; padding: 7px 10px; font-size: 10px; text-transform: uppercase; letter-spacing: .8px; border-bottom: 2px solid #e6ebf2; }
        td   { padding: 7px 10px; border-bottom: 1px solid #e6ebf2; }
        .badge { padding: 2px 8px; border-radius: 4px; font-size: 10px; font-weight: 600; }
        .badge--ok   { background: #ecfdf5; color: #059669; }
        .badge--busy { background: #fef3c7; color: #d97706; }
      </style></head><body>
      <h1>Liste des collaborateurs — SmartAssign</h1>
      <p>Généré le ${new Date().toLocaleDateString('fr-FR')} · ${this.filteredCollaborateurs.length} collaborateur(s)</p>
      <table><thead><tr><th>Nom</th><th>Email</th><th>Rôle</th><th>Expérience</th><th>Disponibilité</th></tr></thead>
      <tbody>${rows}</tbody></table></body></html>`);
    win.document.close();
    win.focus();
    win.print();
  }
}