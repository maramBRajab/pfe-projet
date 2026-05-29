import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, ActivatedRoute } from '@angular/router';
import { of } from 'rxjs';

import { AdminCollaborateurService } from '../../../../services/admin';
import { CompetenceService } from '../../../../services/manager/competence.service';
import { FormulaireCollaborateurComponent } from './formulaire.component';

describe('FormulaireCollaborateurComponent', () => {
  let component: FormulaireCollaborateurComponent;
  let fixture: ComponentFixture<FormulaireCollaborateurComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FormulaireCollaborateurComponent],
      providers: [
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              paramMap: { get: () => null }
            }
          }
        },
        {
          provide: AdminCollaborateurService,
          useValue: {
            create: () => of({}),
            update: () => of({}),
            getById: () => of({})
          }
        },
        {
          provide: CompetenceService,
          useValue: {
            getAll: () => of([])
          }
        }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(FormulaireCollaborateurComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
