import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';

import { AdminProjetService } from '../../../../services/admin';
import { ListeProjetsComponent } from './liste.component';

describe('ListeProjetsComponent', () => {
  let component: ListeProjetsComponent;
  let fixture: ComponentFixture<ListeProjetsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ListeProjetsComponent],
      providers: [
        provideRouter([]),
        { provide: AdminProjetService, useValue: { getAll: () => of([]), delete: () => of(void 0) } }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(ListeProjetsComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
