import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { By } from '@angular/platform-browser';
import { of } from 'rxjs';

import { CollaborateurDashboardComponent } from './dashboard.component';
import { AffectationService } from '../../../services/collaborateur';
import { AuthService } from '../../../services/auth';
import { CollaborateurService, PlanningService } from '../../../services/collaborateur';

const collaborateurStub = {
  id: 1,
  nom: 'Demo',
  prenom: 'Collaborateur',
  email: 'collab@smartassign.tn',
  experienceAnnees: 4,
  disponible: true,
  competences: []
};

const affectationsStub = [
  {
    id: 11,
    projet: {
      id: 101,
      nom: 'Projet Alpha',
      description: 'Refonte portail RH',
      dateDebut: '2026-04-10',
      dateFin: '2026-05-12',
      statut: 'en_cours',
      competencesRequises: []
    },
    collaborateur: collaborateurStub,
    score: 78,
    dateAffectation: '2026-04-08'
  },
  {
    id: 12,
    projet: {
      id: 102,
      nom: 'Projet Beta',
      description: 'Mise a jour CRM',
      dateDebut: '2026-04-15',
      dateFin: '2026-06-01',
      statut: 'en_attente',
      competencesRequises: []
    },
    collaborateur: collaborateurStub,
    score: 42,
    dateAffectation: '2026-04-05'
  }
];

function configureDashboard(): Promise<void> {
  return TestBed.configureTestingModule({
    imports: [CollaborateurDashboardComponent],
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
          getByEmail: () => of(collaborateurStub)
        }
      },
      {
        provide: AffectationService,
        useValue: {
          getByCollaborateur: () => of(affectationsStub)
        }
      },
      {
        provide: PlanningService,
        useValue: {
          getByCollaborateur: () => of({
            collaborateur: collaborateurStub,
            disponibiliteEtat: 'disponible',
            disponibiliteMessage: 'Disponible',
            affectations: affectationsStub,
            taches: [],
            conges: []
          })
        }
      }
    ]
  }).compileComponents();
}

describe('CollaborateursDashboardPageComponent', () => {
  it('should create the dashboard component', async () => {
    await configureDashboard();

    const fixture = TestBed.createComponent(CollaborateurDashboardComponent);
    fixture.detectChanges();

    expect(fixture.componentInstance).toBeTruthy();
  });

  it('should render readable badges and charge indicators', async () => {
    await configureDashboard();

    const fixture = TestBed.createComponent(CollaborateurDashboardComponent);
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent;

    expect(text).toContain('Actives');
    expect(text).toContain('Disponible');
    expect(text).toContain('Projet Alpha');
    expect(text).toContain('Charge elevee 78%');
  });

  it('should expose the expected navigation links on dashboard cards', async () => {
    await configureDashboard();

    const fixture = TestBed.createComponent(CollaborateurDashboardComponent);
    fixture.detectChanges();

    const links = fixture.debugElement.queryAll(By.css('a.focus-card__link'));
    const hrefs = links.map((link) => link.nativeElement.getAttribute('href'));

    expect(hrefs).toContain('/mes-projets');
    expect(hrefs).toContain('/mon-planning');
    expect(hrefs).toContain('/competences');
    expect(hrefs.some((href: string | null) => href?.includes('focus=Projet%20Alpha'))).toBeTruthy();
  });
});