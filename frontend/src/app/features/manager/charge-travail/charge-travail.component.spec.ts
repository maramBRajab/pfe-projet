import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';

import { AffectationService, CollaborateurService } from '../../../services/manager';
import { ManagerChargeTravailComponent } from './charge-travail.component';

describe('ManagerChargeTravailComponent', () => {
  let component: ManagerChargeTravailComponent;
  let fixture: ComponentFixture<ManagerChargeTravailComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ManagerChargeTravailComponent],
      providers: [
        provideRouter([]),
        { provide: CollaborateurService, useValue: { getAll: () => of([]) } },
        { provide: AffectationService, useValue: { getAll: () => of([]) } }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(ManagerChargeTravailComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});