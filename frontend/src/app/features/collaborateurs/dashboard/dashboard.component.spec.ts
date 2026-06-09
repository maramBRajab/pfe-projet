import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { By } from '@angular/platform-browser';
import { of } from 'rxjs';

import { CollaborateurDashboardComponent } from './dashboard.component';
import { AuthService } from '../../../services/auth';
import { CollaborateurService } from '../../../services/collaborateur';

const collaborateurStub = {
  id: 1,
  nom: 'Demo',
  prenom: 'Collaborateur',
  email: 'collab@smartassign.tn',
  experienceAnnees: 4,
  disponible: true,
  competences: [
    { id: 1, nom: 'Angular' },
    { id: 2, nom: 'Spring Boot' }
  ]
};

const dashboardStub = {
  collaborateurId: 1,
  collaborateurNom: 'Collaborateur Demo',
  projetsActifs: 2,
  disponibilite: {
    etat: 'Disponible',
    message: 'Disponible pour les missions en cours.',
    dateDebut: null,
    dateFin: null
  },
  competencesCount: 2,
  chargeMoyenne: 78,
  prochainsJalons: [
    {
      projet: 'Projet Alpha',
      jalon: 'Livraison sprint',
      dateEcheance: '12/05/2026',
      statut: 'en_cours',
      charge: 78
    }
  ],
  pointsVigilance: {
    count: 1,
    entries: ['1 mission(s) avec une charge elevee (>= 80%).']
  },
  journalEntries: [
    {
      action: 'Connexion réussie',
      date: '12/05/2026 10:15',
      details: 'Connexion de test'
    }
  ],
  activiteRecente: [
    {
      initiales: 'PR',
      action: 'Projet prioritaire : Projet Alpha',
      temps: '12/05/2026 - 15/05/2026',
      categorie: 'projet',
      createdAt: '12/05/2026 10:15'
    }
  ]
];

function configureDashboard(): Promise<void> {
  return TestBed.configureTestingModule({
    imports: [CollaborateurDashboardComponent],
    providers: [
      provideRouter([]),
      {
        provide: AuthService,
        useValue: {
          currentUser: { id: 1, nom: 'Collaborateur Demo', email: 'collab@smartassign.tn', role: 'COLLAB' }
        }
      },
      {
        provide: CollaborateurService,
        useValue: {
          getCollaborateur: () => of(collaborateurStub),
          getDashboard: () => of(dashboardStub)
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