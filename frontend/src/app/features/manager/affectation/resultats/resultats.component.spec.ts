import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';

import { AffectationService, ProjetService } from '../../../../services/manager';
import { ManagerResultatsComponent } from './resultats.component';

describe('ManagerResultatsComponent', () => {
  let component: ManagerResultatsComponent;
  let fixture: ComponentFixture<ManagerResultatsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ManagerResultatsComponent],
      providers: [
        { provide: ProjetService, useValue: { getAll: () => of([]) } },
        { provide: AffectationService, useValue: { affecter: () => of([]) } }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(ManagerResultatsComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
