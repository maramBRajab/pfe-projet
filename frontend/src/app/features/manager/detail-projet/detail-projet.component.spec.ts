import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { of } from 'rxjs';

import { AffectationService, ProjetService } from '../../../services/manager';
import { ManagerDetailProjetComponent } from './detail-projet.component';

describe('ManagerDetailProjetComponent', () => {
  let component: ManagerDetailProjetComponent;
  let fixture: ComponentFixture<ManagerDetailProjetComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ManagerDetailProjetComponent],
      providers: [
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { paramMap: new Map([['id', '1']]) } }
        },
        {
          provide: ProjetService,
          useValue: { getById: () => of({ id: 1, nom: 'Projet', description: 'Desc', dateDebut: '2026-01-01', dateFin: '2026-02-01', statut: 'en_cours', competencesRequises: [] }) }
        },
        {
          provide: AffectationService,
          useValue: { getByProjet: () => of([]) }
        }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(ManagerDetailProjetComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});