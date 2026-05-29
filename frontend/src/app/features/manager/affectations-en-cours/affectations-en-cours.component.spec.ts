import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';

import { AffectationService } from '../../../services/manager';
import { ManagerAffectationsEnCoursComponent } from './affectations-en-cours.component';

describe('ManagerAffectationsEnCoursComponent', () => {
  let component: ManagerAffectationsEnCoursComponent;
  let fixture: ComponentFixture<ManagerAffectationsEnCoursComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ManagerAffectationsEnCoursComponent],
      providers: [
        provideRouter([]),
        { provide: AffectationService, useValue: { getAll: () => of([]) } }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(ManagerAffectationsEnCoursComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});