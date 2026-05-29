import { ChangeDetectorRef, Component, EventEmitter, Input, OnChanges, OnInit, Output, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink, ActivatedRoute, Router } from '@angular/router';
import { AdminProjetService, Projet, ProjetRequest } from '../../../../services/admin';
import { AdminTopbarComponent } from '../../shared/admin-topbar.component';
import { AdminSidebarComponent } from '../../shared/admin-sidebar.component';
import { CompetenceService, Competence } from '../../../../services/manager/competence.service';

@Component({
  selector: 'app-formulaire-projet',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, AdminTopbarComponent, AdminSidebarComponent],
  templateUrl: './formulaire.component.html',
  styleUrl: './formulaire.component.scss'
})
export class FormulaireProjetComponent implements OnInit, OnChanges {
  @Input() embedded = false;
  @Output() cancel = new EventEmitter<void>();
  @Output() saved = new EventEmitter<Projet>();

  @Input() set editId(value: number | null) {
    if (value != null && value > 0) {
      this.id = value;
      this.isEditMode = true;
      this.chargerProjet(value);
    }
  }

  isEditMode = false;
  isSaving = false;
  isLoading = false;
  loadingCompetences = false;
  errorMessage = '';
  id: number | null = null;
  availableCompetences: Competence[] = [];
  selectedCompetenceIds: number[] = [];

  projet: Projet = {
    nom: '',
    description: '',
    dateDebut: '',
    dateFin: '',
    statut: 'en_attente',
    competencesRequises: []
  };

  constructor(
    private adminProjetService: AdminProjetService,
    private competenceService: CompetenceService,
    private route: ActivatedRoute,
    private router: Router,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['embedded']?.currentValue && !this.isEditMode) {
      this.resetFormState();
    }
  }

  get listRoute(): string[] {
    return ['/admin/projets'];
  }

  get title(): string {
    if (this.isEditMode) {
      return 'Modifier le projet';
    }

    return this.embedded ? 'Nouveau projet' : 'Créer un projet';
  }

  get descriptionText(): string {
    return this.embedded
      ? 'Renseignez les informations du projet directement dans cette fenêtre afin de l’ajouter au référentiel global.'
      : 'Renseignez les informations du projet pour maintenir un référentiel global cohérent et accessible depuis l’administration.';
  }

  ngOnInit(): void {
    this.loadCompetences();
    const routeId = Number(this.route.snapshot.params['id']);
    if (!Number.isNaN(routeId) && routeId > 0 && !this.isEditMode) {
      this.id = routeId;
      this.isEditMode = true;
      this.chargerProjet(routeId);
    }
  }

  private chargerProjet(id: number): void {
    this.isLoading = true;
    this.errorMessage = '';
    this.adminProjetService.getById(id).subscribe({
      next: data => {
        this.projet = data;
        this.selectedCompetenceIds = (data.competencesRequises ?? [])
          .map((competence: Competence) => competence.id)
          .filter((id): id is number => typeof id === 'number');
        this.syncSelectedCompetences();
        this.isLoading = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.errorMessage = 'Erreur lors du chargement du projet.';
        this.isLoading = false;
        this.cdr.detectChanges();
      }
    });
  }

  get formInvalid(): boolean {
    return !this.projet.nom.trim()
      || !this.projet.description.trim()
      || !this.projet.dateDebut
      || !this.projet.dateFin
      || this.projet.dateFin < this.projet.dateDebut;
  }

  get competencesPreview(): string {
    if (!this.selectedCompetenceIds.length) {
      return 'Aucune compétence requise';
    }

    return `${this.selectedCompetenceIds.length} compétence(s) requise(s)`;
  }

  get projectNamePreview(): string {
    return this.projet.nom.trim() || 'Nouveau projet';
  }

  get statusLabel(): string {
    switch ((this.projet.statut ?? '').toLowerCase()) {
      case 'en_cours':
        return 'En cours';
      case 'termine':
        return 'Terminé';
      default:
        return 'En attente';
    }
  }

  get periodLabel(): string {
    if (!this.projet.dateDebut || !this.projet.dateFin) {
      return 'Période à définir';
    }

    return `${this.projet.dateDebut} → ${this.projet.dateFin}`;
  }

  get durationDays(): number {
    if (!this.projet.dateDebut || !this.projet.dateFin) {
      return 0;
    }

    const start = new Date(this.projet.dateDebut).getTime();
    const end = new Date(this.projet.dateFin).getTime();

    return Math.max(0, Math.round((end - start) / 86_400_000) + 1);
  }

  get projectInitials(): string {
    return this.projectNamePreview
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? '')
      .join('') || 'PR';
  }

  isCompetenceSelected(id: number | undefined): boolean {
    return typeof id === 'number' && this.selectedCompetenceIds.includes(id);
  }

  toggleCompetence(id: number | undefined): void {
    if (typeof id !== 'number') {
      return;
    }

    this.selectedCompetenceIds = this.isCompetenceSelected(id)
      ? this.selectedCompetenceIds.filter((value) => value !== id)
      : [...this.selectedCompetenceIds, id];
  }

  sauvegarder() {
    if (this.formInvalid || this.isSaving) {
      return;
    }

    this.isSaving = true;
    this.errorMessage = '';
    this.syncSelectedCompetences();

    const payload: ProjetRequest = {
      nom: this.projet.nom.trim(),
      description: this.projet.description.trim(),
      dateDebut: this.projet.dateDebut,
      dateFin: this.projet.dateFin,
      statut: this.projet.statut,
      competenceIds: this.selectedCompetenceIds
    };

    const action = this.isEditMode && this.id
      ? this.adminProjetService.update(this.id, payload)
      : this.adminProjetService.create(payload);

    action.subscribe({
      next: (projet) => {
        this.isSaving = false;

        if (this.embedded) {
          this.saved.emit(projet);
          this.resetFormState();
          return;
        }

        this.router.navigate(this.listRoute);
      },
      error: (error) => {
        this.errorMessage = this.extractErrorMessage(error, 'Erreur lors de l\'enregistrement.');
        this.isSaving = false;
      }
    });
  }

  handleCancel(): void {
    if (this.embedded) {
      this.cancel.emit();
      this.resetFormState();
      return;
    }

    this.router.navigate(this.listRoute);
  }

  private loadCompetences(): void {
    this.loadingCompetences = true;
    this.competenceService.getAll().subscribe({
      next: (competences) => {
        this.availableCompetences = competences;
        this.loadingCompetences = false;
        this.syncSelectedCompetences();
      },
      error: () => {
        this.loadingCompetences = false;
        this.errorMessage = 'Erreur lors du chargement des competences.';
      }
    });
  }

  private syncSelectedCompetences(): void {
    this.projet.competencesRequises = this.availableCompetences.filter((competence) =>
      typeof competence.id === 'number' && this.selectedCompetenceIds.includes(competence.id)
    );
  }

  private resetFormState(): void {
    if (this.isEditMode) {
      return;
    }

    this.errorMessage = '';
    this.isSaving = false;
    this.projet = {
      nom: '',
      description: '',
      dateDebut: '',
      dateFin: '',
      statut: 'en_attente',
      competencesRequises: []
    };
    this.selectedCompetenceIds = [];
  }

  private extractErrorMessage(error: unknown, fallback: string): string {
    const apiError = error as {
      error?: { message?: string; validationErrors?: Record<string, string> };
    };

    const validationErrors = apiError?.error?.validationErrors;
    if (validationErrors) {
      const firstValidationMessage = Object.values(validationErrors)[0];
      if (firstValidationMessage) {
        return firstValidationMessage;
      }
    }

    return apiError?.error?.message ?? fallback;
  }
}