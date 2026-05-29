import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';

import { AdminCollaborateurService } from '../../../../services/admin';
import { ListeCollaborateursComponent } from './liste.component';

describe('ListeCollaborateursComponent', () => {
  let component: ListeCollaborateursComponent;
  let fixture: ComponentFixture<ListeCollaborateursComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ListeCollaborateursComponent],
      providers: [
        provideRouter([]),
        {
          provide: AdminCollaborateurService,
          useValue: {
            getAll: () => of([]),
            delete: () => of(void 0),
            toggleDisponibilite: () => of({})
          }
        }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(ListeCollaborateursComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
