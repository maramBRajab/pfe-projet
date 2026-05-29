import { By } from '@angular/platform-browser';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { of } from 'rxjs';

import { CollaborateurPlanningComponent } from './planning.component';
import { AffectationService, CollaborateurService, PlanningService } from '../../../services/collaborateur';
import { AuthService } from '../../../services/auth';

describe('CollaborateurPlanningPageComponent', () => {
  async function createComponent() {
    const baseDate = new Date();
    const baseYear = baseDate.getFullYear();
    const baseMonth = baseDate.getMonth();
    const formatDate = (day: number) => {
      const month = String(baseMonth + 1).padStart(2, '0');
      const date = String(day).padStart(2, '0');
      return `${baseYear}-${month}-${date}`;
    };

    await TestBed.configureTestingModule({
      imports: [CollaborateurPlanningComponent],
      providers: [
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              queryParamMap: convertToParamMap({})
            }
          }
        },
        {
          provide: AuthService,
          useValue: {
            currentUser: { nom: 'Collaborateur Demo', email: 'collab@smartassign.tn' }
          }
        },
        {
          provide: CollaborateurService,
          useValue: {
            getByEmail: () => of({ id: 1, nom: 'Demo', prenom: 'Collaborateur', email: 'collab@smartassign.tn', experienceAnnees: 4, disponible: true, competences: [] })
          }
        },
        {
          provide: AffectationService,
          useValue: {
            getByCollaborateur: () => of([])
          }
        },
        {
          provide: PlanningService,
          useValue: {
            getByCollaborateur: () => of({
              collaborateur: { id: 1, nom: 'Demo', prenom: 'Collaborateur', email: 'collab@smartassign.tn', experienceAnnees: 4, disponible: true, competences: [] },
              disponibiliteEtat: 'disponible',
              disponibiliteMessage: 'Disponible',
              affectations: [
                {
                  id: 7,
                  score: 88,
                  projet: {
                    id: 10,
                    nom: 'Projet Atlas',
                    dateDebut: formatDate(8),
                    dateFin: formatDate(10),
                    statut: 'en_cours'
                  }
                }
              ],
              taches: [
                {
                  id: 9,
                  titre: 'Point de synchro',
                  description: 'Tache de test',
                  dateEcheance: formatDate(10),
                  statut: 'EN_COURS',
                  priorite: 'MOYENNE',
                  projetId: 10,
                  projetNom: 'Projet Atlas'
                }
              ],
              conges: [
                {
                  id: 5,
                  libelle: 'Conge',
                  type: 'Absence',
                  dateDebut: formatDate(12),
                  dateFin: formatDate(13),
                  impactDisponibilite: 'INDISPONIBLE'
                }
              ]
            })
          }
        }
      ]
    }).compileComponents();

    const fixture = TestBed.createComponent(CollaborateurPlanningComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture;
  }

  it('should create the planning component', async () => {
    const fixture = await createComponent();
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('should always build a 42-day calendar aligned on monday', async () => {
    const fixture = await createComponent();
    const component = fixture.componentInstance;

    component.viewedMonth = new Date(component.today.getFullYear(), component.today.getMonth(), 1);
    component['refreshView']();
    fixture.detectChanges();

    expect(component.calendarDays.length).toBe(42);
    expect(component.calendarDays[0].date.getDay()).toBe(1);
    expect(component.calendarDays.every((day) => typeof day.isToday === 'boolean')).toBe(true);
  });

  it('should rebuild the calendar when navigating months', async () => {
    const fixture = await createComponent();
    const component = fixture.componentInstance;
    const initialMonth = component.viewedMonth.getMonth();

    component.nextMonth();
    fixture.detectChanges();
    expect(component.viewedMonth.getMonth()).toBe((initialMonth + 1) % 12);
    expect(component.calendarDays.length).toBe(42);

    component.previousMonth();
    fixture.detectChanges();
    expect(component.viewedMonth.getMonth()).toBe(initialMonth);

    component.resetMonth();
    fixture.detectChanges();
    expect(component.viewedMonth.getMonth()).toBe(component.today.getMonth());
    expect(component.viewedMonth.getFullYear()).toBe(component.today.getFullYear());
  });

  it('should render 42 calendar cells with outside, today, and marker classes bound correctly', async () => {
    const fixture = await createComponent();
    const component = fixture.componentInstance;

    component.viewedMonth = new Date(component.today.getFullYear(), component.today.getMonth(), 1);
    component['refreshView']();
    fixture.detectChanges();

    const cells = fixture.debugElement.queryAll(By.css('.calendar-grid .calendar-cell'));
    const todayCell = fixture.debugElement.query(By.css('.calendar-cell.is-today'));
    const outsideCells = fixture.debugElement.queryAll(By.css('.calendar-cell.is-outside'));
    const markerNodes = fixture.debugElement.queryAll(By.css('.calendar-cell .marker'));

    expect(cells.length).toBe(42);
    expect(todayCell).not.toBeNull();
    expect(outsideCells.length).toBeGreaterThan(0);
    expect(markerNodes.length).toBeGreaterThan(0);
    expect(component.calendarDays.find((day) => day.dayNumber === 10 && day.inCurrentMonth)?.markers).toEqual(['mission', 'task']);
  });
});