import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';

import { CollaborateurHistoriqueComponent } from './historique.component';
import { AffectationService } from '../../../services/collaborateur';
import { AuthService } from '../../../services/auth';
import { CollaborateurService, ProjetService } from '../../../services/collaborateur';

describe('CollaborateurHistoriquePageComponent', () => {
  it('should create the history component', async () => {
    await TestBed.configureTestingModule({
      imports: [CollaborateurHistoriqueComponent],
      providers: [
        provideRouter([]),
        {
          provide: AuthService,
          useValue: {
            currentUser: { nom: 'Collaborateur Demo', email: 'collab@smartassign.tn', role: 'COLLAB' }
          }
        },
        {
          provide: CollaborateurService,
          useValue: {
            getByEmail: () => of({ id: 1, nom: 'Demo', prenom: 'Collaborateur', email: 'collab@smartassign.tn', experienceAnnees: 4, disponible: true, competences: [] })
          }
        },
        {
          provide: AffectationService,
          useValue: {
            getByCollaborateur: () => of([])
          }
        },
        {
          provide: ProjetService,
          useValue: {
            getAll: () => of([])
          }
        }
      ]
    }).compileComponents();

    const fixture = TestBed.createComponent(CollaborateurHistoriqueComponent);
    fixture.detectChanges();

    expect(fixture.componentInstance).toBeTruthy();
  });
});