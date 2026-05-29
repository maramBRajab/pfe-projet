import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { of } from 'rxjs';

import { CollaborateurMesProjetsComponent } from './mes-projets.component';
import { AffectationService } from '../../../services/collaborateur';
import { AuthService } from '../../../services/auth';
import { CollaborateurService, NotificationService, ProjetService } from '../../../services/collaborateur';

describe('CollaborateurMesProjetsPageComponent', () => {
  it('should create the projects component', async () => {
    await TestBed.configureTestingModule({
      imports: [CollaborateurMesProjetsComponent],
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
        },
        {
          provide: NotificationService,
          useValue: {
            pushLocal: () => void 0
          }
        }
      ]
    }).compileComponents();

    const fixture = TestBed.createComponent(CollaborateurMesProjetsComponent);
    fixture.detectChanges();

    expect(fixture.componentInstance).toBeTruthy();
  });
});