import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';

import { AffectationService } from '../../../services/manager';
import { ManagerHistoriqueAffectationsComponent } from './historique-affectations.component';

describe('ManagerHistoriqueAffectationsComponent', () => {
  let component: ManagerHistoriqueAffectationsComponent;
  let fixture: ComponentFixture<ManagerHistoriqueAffectationsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ManagerHistoriqueAffectationsComponent],
      providers: [
        provideRouter([]),
        { provide: AffectationService, useValue: { getAll: () => of([]) } }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(ManagerHistoriqueAffectationsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});