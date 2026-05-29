import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router } from '@angular/router';
import { of } from 'rxjs';

import { AdminProjetService } from '../../../../services/admin';
import { CompetenceService } from '../../../../services/manager/competence.service';
import { FormulaireProjetComponent } from './formulaire.component';

describe('FormulaireProjetComponent', () => {
  let component: FormulaireProjetComponent;
  let fixture: ComponentFixture<FormulaireProjetComponent>;

  // ── Stubs des services ────────────────────────────────────────────────────
  const projetServiceStub = {
    getById: jasmine.createSpy('getById').and.returnValue(of(null)),
    create:  jasmine.createSpy('create').and.returnValue(of({})),
    update:  jasmine.createSpy('update').and.returnValue(of({})),
  };

  const competenceServiceStub = {
    getAll: jasmine.createSpy('getAll').and.returnValue(of([])),
  };

  const routerStub = {
    navigate: jasmine.createSpy('navigate'),
  };

  // ── Configuration du module de test ───────────────────────────────────────
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FormulaireProjetComponent],
      providers: [
        { provide: AdminProjetService, useValue: projetServiceStub      },
        { provide: CompetenceService,  useValue: competenceServiceStub  },
        { provide: Router,             useValue: routerStub             },
        { provide: ActivatedRoute,     useValue: { snapshot: { params: {} } } },
      ],
    }).compileComponents();

    fixture   = TestBed.createComponent(FormulaireProjetComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  // ── Tests ─────────────────────────────────────────────────────────────────
  it('should create', () => {
    expect(component).toBeTruthy();
  });
});