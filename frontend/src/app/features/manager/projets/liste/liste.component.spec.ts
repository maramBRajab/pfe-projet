import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';

import { ProjetService } from '../../../../services/manager';
import { ManagerListeProjetsComponent } from './liste.component';

describe('ManagerListeProjetsComponent', () => {
  let component: ManagerListeProjetsComponent;
  let fixture: ComponentFixture<ManagerListeProjetsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ManagerListeProjetsComponent],
      providers: [
        provideRouter([]),
        { provide: ProjetService, useValue: { getAll: () => of([]), delete: () => of(void 0) } }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(ManagerListeProjetsComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
