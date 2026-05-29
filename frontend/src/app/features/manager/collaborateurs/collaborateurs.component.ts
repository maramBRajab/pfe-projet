import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ManagerShellComponent } from '../shared/manager-shell.component';
import { CollaborateurService, Collaborateur, CollaborateurRequest } from '../../../services/manager/collaborateur.service';
import { CompetenceService, Competence } from '../../../services/manager/competence.service';
import { FormulaireCollaborateurComponent } from '../../admin/collaborateurs/formulaire/formulaire.component';

@Component({
  selector: 'app-manager-collaborateurs',
  standalone: true,
  imports: [CommonModule, FormsModule, ManagerShellComponent, FormulaireCollaborateurComponent],
  templateUrl: './collaborateurs.component.html',
  styleUrl: './collaborateurs.component.scss'
})
export class ManagerCollaborateursComponent implements OnInit {

  collaborateurs: Collaborateur[] = [];
  isLoading = false;
  errorMessage = '';

  searchTerm = '';
  disponibiliteFilter: 'all' | 'disponible' | 'occupe' = 'all';
  niveauFilter: 'all' | 'junior' | 'confirme' | 'senior' = 'all';

  currentPage = 1;
  pageSize = 10;

  readonly AVATAR_COLORS = ['#3b82f6','#10b981','#8b5cf6','#f59e0b','#ef4444','#0ea5e9','#d946ef','#14b8a6'];

  // ── Edit modal state ───────────────────────────────────────────
  editingCollab: Collaborateur | null = null;
  editForm: CollaborateurRequest = { nom: '', prenom: '', email: '', experienceAnnees: 0, disponible: true, competenceIds: [] };
  isSavingEdit = false;
  editError = '';
  editToast = '';
  availableCompetences: Competence[] = [];
  competenceSearch = '';

  constructor(
    private collaborateurService: CollaborateurService,
    private competenceService: CompetenceService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.charger();
  }

  charger(): void {
    this.isLoading = true;
    this.errorMessage = '';
    this.collaborateurService.getAll().subscribe({
      next: (data) => {
        this.collaborateurs = data;
        this.isLoading = false;
      },
      error: () => {
        this.errorMessage = 'Impossible de charger les collaborateurs.';
        this.isLoading = false;
      }
    });
  }

  reinitialiser(): void {
    this.searchTerm = '';
    this.disponibiliteFilter = 'all';
    this.niveauFilter = 'all';
    this.currentPage = 1;
  }

  exportCSV(): void {
    const header = 'Prénom,Nom,Email,Expérience,Disponible';
    const rows = this.filtered.map(c =>
      `${c.prenom},${c.nom},${c.email},${c.experienceAnnees},${c.disponible ? 'Oui' : 'Non'}`
    );
    const blob = new Blob([[header, ...rows].join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'collaborateurs.csv';
    a.click();
    URL.revokeObjectURL(url);
  }

  get filtered(): Collaborateur[] {
    const term = this.searchTerm.toLowerCase().trim();
    return this.collaborateurs.filter(c => {
      const matchSearch = !term ||
        c.nom.toLowerCase().includes(term) ||
        c.prenom.toLowerCase().includes(term) ||
        c.email.toLowerCase().includes(term) ||
        (c.competences ?? []).some(k => k.nom.toLowerCase().includes(term));
      const matchDispo =
        this.disponibiliteFilter === 'all' ||
        (this.disponibiliteFilter === 'disponible' && c.disponible) ||
        (this.disponibiliteFilter === 'occupe' && !c.disponible);
      const matchNiveau = this.niveauFilter === 'all' ||
        (this.niveauFilter === 'junior'   && c.experienceAnnees < 3) ||
        (this.niveauFilter === 'confirme' && c.experienceAnnees >= 3 && c.experienceAnnees < 6) ||
        (this.niveauFilter === 'senior'   && c.experienceAnnees >= 6);
      return matchSearch && matchDispo && matchNiveau;
    });
  }

  get paged(): Collaborateur[] {
    const start = (this.currentPage - 1) * this.pageSize;
    return this.filtered.slice(start, start + this.pageSize);
  }

  get totalPages(): number {
    return Math.max(1, Math.ceil(this.filtered.length / this.pageSize));
  }

  get disponiblesCount(): number {
    return this.collaborateurs.filter(c => c.disponible).length;
  }

  get occupesCount(): number {
    return this.collaborateurs.filter(c => !c.disponible).length;
  }

  get moyenneExperience(): number {
    if (!this.collaborateurs.length) return 0;
    const avg = this.collaborateurs.reduce((s, c) => s + c.experienceAnnees, 0) / this.collaborateurs.length;
    return Math.round(avg);
  }

  get totalCompetences(): number {
    return this.collaborateurs.reduce((s, c) => s + (c.competences?.length ?? 0), 0);
  }

  initiales(c: Collaborateur): string {
    return `${c.prenom.charAt(0)}${c.nom.charAt(0)}`.toUpperCase();
  }

  avatarColor(c: Collaborateur): string {
    const idx = ((c.id ?? 0) % this.AVATAR_COLORS.length);
    return this.AVATAR_COLORS[idx];
  }

  expLabel(annees: number): string {
    return annees <= 1 ? `${annees} an` : `${annees} ans`;
  }

  editer(c: Collaborateur): void {
    this.openEditModal(c);
  }

  nouveauCollaborateur(): void {
    this.isCreateOpen = true;
  }

  closeCreateModal(): void {
    this.isCreateOpen = false;
  }

  onCollaborateurCreated(): void {
    this.isCreateOpen = false;
    this.charger();
  }

  isCreateOpen = false;

  // ── VIEW MODAL ───────────────────────────────────────────────
  viewedCollab: Collaborateur | null = null;

  openViewModal(c: Collaborateur): void {
    this.viewedCollab = c;
  }

  closeViewModal(): void {
    this.viewedCollab = null;
  }
  // ── DELETE MODAL ────────────────────────────────────────────────────
  deleteTarget: Collaborateur | null = null;
  isDeleting = false;
  deleteToast = '';

  get deleteTargetName(): string {
    return this.deleteTarget ? `${this.deleteTarget.prenom} ${this.deleteTarget.nom}`.trim() : '';
  }

  openDeleteModal(c: Collaborateur): void {
    if (this.isDeleting) return;
    this.deleteTarget = c;
  }

  closeDeleteModal(): void {
    if (this.isDeleting) return;
    this.deleteTarget = null;
  }

  confirmerSuppression(): void {
    if (!this.deleteTarget?.id || this.isDeleting) return;
    this.isDeleting = true;
    const targetName = this.deleteTargetName;
    this.collaborateurService.delete(this.deleteTarget.id).subscribe({
      next: () => {
        this.collaborateurs = this.collaborateurs.filter(c => c.id !== this.deleteTarget?.id);
        this.isDeleting = false;
        this.deleteTarget = null;
        this.deleteToast = `${targetName} supprimé(e).`;
        setTimeout(() => (this.deleteToast = ''), 3000);
      },
      error: (err) => {
        console.error('Suppression collaborateur échouée :', err);
        this.isDeleting = false;
        this.editError = err?.error?.message || 'Impossible de supprimer ce collaborateur.';
        this.deleteTarget = null;
      }
    });
  }
  // ── EDIT MODAL ────────────────────────────────────────────────────────
  openEditModal(c: Collaborateur): void {
    this.editingCollab = c;
    this.editForm = {
      nom: c.nom,
      prenom: c.prenom,
      email: c.email,
      experienceAnnees: c.experienceAnnees,
      disponible: c.disponible,
      competenceIds: (c.competences ?? []).map(k => k.id!).filter(id => id != null)
    };
    this.editError = '';
    this.competenceSearch = '';
    if (!this.availableCompetences.length) {
      this.competenceService.getAll().subscribe({
        next: list => this.availableCompetences = list,
        error: () => { /* silencieux : on garde les comps existantes */ }
      });
    }
  }

  closeEditModal(): void {
    this.editingCollab = null;
    this.editError = '';
    this.isSavingEdit = false;
  }

  toggleEditCompetence(id: number): void {
    const ids = this.editForm.competenceIds ?? [];
    const idx = ids.indexOf(id);
    if (idx >= 0) ids.splice(idx, 1); else ids.push(id);
    this.editForm.competenceIds = [...ids];
  }

  isCompetenceSelected(id: number): boolean {
    return (this.editForm.competenceIds ?? []).includes(id);
  }

  get filteredEditCompetences(): Competence[] {
    const q = this.competenceSearch.trim().toLowerCase();
    if (!q) return this.availableCompetences;
    return this.availableCompetences.filter(c => c.nom.toLowerCase().includes(q));
  }

  get editFormInvalid(): boolean {
    return !this.editForm.nom.trim()
        || !this.editForm.prenom.trim()
        || this.editForm.experienceAnnees < 0;
  }

  saveEdit(): void {
    if (!this.editingCollab?.id || this.editFormInvalid || this.isSavingEdit) return;
    this.isSavingEdit = true;
    this.editError = '';
    this.collaborateurService.update(this.editingCollab.id, this.editForm).subscribe({
      next: updated => {
        this.collaborateurs = this.collaborateurs.map(c => c.id === updated.id ? updated : c);
        this.editToast = 'Collaborateur mis à jour avec succès.';
        setTimeout(() => this.editToast = '', 2500);
        this.closeEditModal();
      },
      error: (err) => {
        this.editError = err?.error?.message || 'Impossible d’enregistrer les modifications.';
        this.isSavingEdit = false;
      }
    });
  }
}
