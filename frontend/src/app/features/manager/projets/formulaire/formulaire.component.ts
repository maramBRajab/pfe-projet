import { Component, EventEmitter, Input, OnChanges, OnInit, Output, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink, ActivatedRoute, Router } from '@angular/router';
import { Projet, ProjetRequest, ProjetService, Competence, CompetenceService } from '../../../../services/manager';
import { ManagerShellComponent } from '../../shared/manager-shell.component';

@Component({
  selector: 'app-formulaire-projet',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, ManagerShellComponent],
  templateUrl: './formulaire.component.html',
  styleUrl: './formulaire.component.scss'
})
export class ManagerFormulaireProjetComponent implements OnInit, OnChanges {
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
    private service: ProjetService,
    private competenceService: CompetenceService,
    private route: ActivatedRoute,
    private router: Router
  ) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['embedded']?.currentValue && !this.isEditMode) {
      this.resetFormState();
    }
  }

  get listRoute(): string[] {
    return ['/manager/projets'];
  }

  get title(): string {
    return this.isEditMode ? 'Modifier le projet' : 'Nouveau projet';
  }

  get descriptionText(): string {
    return this.embedded
      ? 'Renseignez le nom, la description, les compétences requises, la durée et le statut du projet dans cette fenêtre.'
      : 'Renseignez le nom, la description, les compétences requises, la durée et le statut du projet sans changer la logique de gestion.';
  }

  ngOnInit(): void {
    this.loadCompetences();
    const routeId = this.route.snapshot.params['id'];
    if (routeId && !this.isEditMode) {
      this.id = Number(routeId);
      this.isEditMode = true;
      this.chargerProjet(this.id);
    }
  }

  private chargerProjet(id: number): void {
    this.isLoading = true;
    this.service.getById(id).subscribe({
      next: data => {
        this.projet = data;
        this.selectedCompetenceIds = (data.competencesRequises ?? [])
          .map((competence: Competence) => competence.id)
          .filter((id): id is number => typeof id === 'number');
        this.syncSelectedCompetences();
        this.isLoading = false;
      },
      error: () => {
        this.errorMessage = 'Impossible de charger ce projet pour modification.';
        this.isLoading = false;
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
      ? this.service.update(this.id, payload)
      : this.service.create(payload);

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
        this.errorMessage = this.extractErrorMessage(error, 'Impossible d’enregistrer le projet.');
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
        this.errorMessage = 'Impossible de charger les compétences requises disponibles.';
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