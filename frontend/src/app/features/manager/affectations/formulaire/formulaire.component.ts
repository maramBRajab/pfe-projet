import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink, ActivatedRoute, Router } from '@angular/router';
import {
  Affectation,
  AffectationService,
  Collaborateur,
  CollaborateurService,
} from '../../../../services/manager';
import { ManagerShellComponent } from '../../shared/manager-shell.component';

@Component({
  selector: 'app-formulaire-affectation',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, ManagerShellComponent],
  templateUrl: './formulaire.component.html',
  styleUrl: './formulaire.component.scss',
})
export class ManagerFormulaireAffectationComponent implements OnInit {
  id: number | null = null;
  isLoading = false;
  isSaving = false;
  errorMessage = '';

  affectation: Affectation | null = null;
  collaborateurs: Collaborateur[] = [];
  selectedCollaborateurId: number | null = null;

  constructor(
    private affectationService: AffectationService,
    private collaborateurService: CollaborateurService,
    private route: ActivatedRoute,
    private router: Router,
    private cdr: ChangeDetectorRef,
  ) {}

  get listRoute(): string[] {
    return ['/manager/affectations-en-cours'];
  }

  get formInvalid(): boolean {
    return !this.selectedCollaborateurId;
  }

  get selectedCollaborateur(): Collaborateur | undefined {
    return this.collaborateurs.find(c => c.id === this.selectedCollaborateurId);
  }

  ngOnInit(): void {
    const routeId = Number(this.route.snapshot.paramMap.get('id'));
    if (!Number.isNaN(routeId) && routeId > 0) {
      this.id = routeId;
      this.chargerAffectation(routeId);
    } else {
      this.errorMessage = 'Identifiant d\'affectation invalide.';
    }
    this.chargerCollaborateurs();
  }

  sauvegarder(): void {
    if (this.formInvalid || this.isSaving || !this.id || !this.selectedCollaborateurId) return;
    this.isSaving = true;
    this.errorMessage = '';

    this.affectationService.update(this.id, { collaborateurId: this.selectedCollaborateurId }).subscribe({
      next: () => this.router.navigate(this.listRoute),
      error: () => {
        this.errorMessage = 'Impossible de modifier cette affectation.';
        this.isSaving = false;
        this.cdr.detectChanges();
      },
    });
  }

  private chargerAffectation(id: number): void {
    this.isLoading = true;
    this.affectationService.getById(id).subscribe({
      next: data => {
        this.affectation = data;
        this.selectedCollaborateurId = data.collaborateur?.id ?? null;
        this.isLoading = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.errorMessage = 'Impossible de charger l\'affectation.';
        this.isLoading = false;
        this.cdr.detectChanges();
      },
    });
  }

  private chargerCollaborateurs(): void {
    this.collaborateurService.getAll().subscribe({
      next: data => {
        this.collaborateurs = data;
        this.cdr.detectChanges();
      },
      error: () => {},
    });
  }
}
