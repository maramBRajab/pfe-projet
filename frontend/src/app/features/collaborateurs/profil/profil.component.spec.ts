import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { of } from 'rxjs';

import { CollaborateurProfilComponent } from './profil.component';
import { AffectationService } from '../../../services/collaborateur';
import { AuthService } from '../../../services/auth';
import { CollaborateurService, CompetenceService } from '../../../services/collaborateur';

describe('CollaborateurProfilPageComponent', () => {
  it('should create the profile component', async () => {
    await TestBed.configureTestingModule({
      imports: [CollaborateurProfilComponent],
      providers: [
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              queryParamMap: convertToParamMap({})
            }
          }
        },
        {
          provide: AuthService,
          useValue: {
            currentUser: { nom: 'Collaborateur Demo', email: 'collab@smartassign.tn', role: 'COLLAB' },
            updateStoredUser: () => void 0
          }
        },
        {
          provide: CollaborateurService,
          useValue: {
            getByEmail: () => of({ id: 1, nom: 'Demo', prenom: 'Collaborateur', email: 'collab@smartassign.tn', experienceAnnees: 4, disponible: true, competences: [] }),
            update: () => of({})
          }
        },
        {
          provide: CompetenceService,
          useValue: {
            getAll: () => of([])
          }
        },
        {
          provide: AffectationService,
          useValue: {
            getByCollaborateur: () => of([])
          }
        }
      ]
    }).compileComponents();

    const fixture = TestBed.createComponent(CollaborateurProfilComponent);
    fixture.detectChanges();

    expect(fixture.componentInstance).toBeTruthy();
  });
});