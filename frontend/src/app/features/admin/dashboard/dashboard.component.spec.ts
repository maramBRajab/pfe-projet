import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';

import { AdminDashboardService } from '../../../services/admin';
import { AdminDashboardComponent } from './dashboard.component';

// ── Stubs ──────────────────────────────────────────────────────────
const emptyStats = {
  projetsActifs:         0,
  totalProjets:          0,
  totalCollaborateurs:   0,
  tauxAffectation:       0,
  managersActifs:        0,
  totalManagers:         0,
  projetsEnRetard:       0,
  ressourcesDisponibles: 0,
  nouveauxProjets:       0,
  nouveauxCollabs:       0,
};

const filledStats = {
  projetsActifs:         5,
  totalProjets:          7,
  totalCollaborateurs:   20,
  tauxAffectation:       80,
  managersActifs:         3,
  totalManagers:          4,
  projetsEnRetard:        1,
  ressourcesDisponibles:  6,
  nouveauxProjets:        2,
  nouveauxCollabs:        3,
};

const emptyRepartition = { collaborateurs: 0, managers: 0, admins: 0 };
const filledRepartition = { collaborateurs: 38, managers: 8, admins: 2 };

const evolutionStub = [
  { mois: 'Nov', actifs: 8,  termines: 3 },
  { mois: 'Déc', actifs: 9,  termines: 4 },
  { mois: 'Jan', actifs: 11, termines: 5 },
  { mois: 'Fév', actifs: 10, termines: 6 },
  { mois: 'Mar', actifs: 13, termines: 7 },
  { mois: 'Avr', actifs: 12, termines: 8 },
];

const alertesStub = [
  { type: 'danger',  icon: '', message: '3 projets dépassent la date limite',              time: 'il y a 2h' },
  { type: 'warning', icon: '', message: '5 collaborateurs non affectés depuis 2 semaines', time: 'il y a 4h' },
];

const activitesStub = [
  {
    initiales: 'MA',
    action: 'Nouveau collaborateur ajouté : Malek Amari',
    temps: 'il y a 15 min',
    categorie: 'collab',
    createdAt: '2026-06-01T10:15:00',
    role: 'ADMIN',
    level: 'Info'
  },
  {
    initiales: 'SB',
    action: 'Projet "App Mobile" créé',
    temps: 'il y a 1h',
    categorie: 'projet',
    createdAt: '2026-06-01T09:30:00',
    role: 'MANAGER',
    level: 'Warning'
  },
];

const insightsStub = {
  platformHealth: {
    score: 74,
    label: 'Sous surveillance',
    summary: 'La plateforme reste pilotable mais demande un suivi rapproché.',
    tone: 'watch',
    factors: [
      { label: 'Execution projet', score: 68, tone: 'watch', detail: '1 projet en retard' }
    ]
  },
  criticalProjects: [
    {
      id: 101,
      nom: 'Programme CRM 360',
      manager: 'Pilotage a confirmer',
      statut: 'En retard',
      charge: 91,
      assignmentCount: 2,
      averageScore: 88.4,
      daysLeft: 2,
      risk: 'Retard constate sur le portefeuille.',
      recommendation: 'Reallouer des ressources.',
      link: '/admin/projets/edit/101',
      tone: 'risk'
    }
  ],
  upcomingDeadlines: [
    {
      id: 101,
      nom: 'Programme CRM 360',
      owner: 'Pilotage a confirmer',
      dueLabel: '2 jours',
      daysLeft: 2,
      tone: 'risk',
      link: '/admin/projets/edit/101'
    }
  ],
  collaboratorLoad: [
    {
      id: 11,
      name: 'Malek Amari',
      role: 'Collaborateur',
      load: 88,
      assignmentCount: 2,
      activeProjects: 2,
      availabilityLabel: 'Indisponible',
      skills: 'Angular • UX',
      tone: 'risk',
      link: '/admin/collaborateurs/edit/11'
    }
  ],
  suggestions: [
    {
      title: 'Reaffecter rapidement des ressources',
      detail: 'Une ressource disponible peut soulager le projet prioritaire.',
      actionLabel: 'Ouvrir les affectations',
      link: '/manager/affectations-en-cours',
      tone: 'risk'
    }
  ]
};

const searchResultsStub = [
  {
    type: 'Projet',
    title: 'Programme CRM 360',
    subtitle: 'En retard • echeance 2 jours',
    link: '/admin/projets/edit/101'
  },
  {
    type: 'Utilisateur',
    title: 'Karim Trabelsi',
    subtitle: 'Manager • karim.trabelsi@smartassign.tn',
    link: '/admin/collaborateurs/edit/12'
  }
];

// ── Helper ─────────────────────────────────────────────────────────
function buildService(overrides: Partial<{
  statsError:      boolean;
  evolutionError:  boolean;
  repartitionData: typeof emptyRepartition;
  alertesData:     typeof alertesStub;
  activitesData:   typeof activitesStub;
  statsData:       typeof emptyStats;
  insightsData:    typeof insightsStub | null;
  searchData:      typeof searchResultsStub;
}> = {}) {
  return {
    getStats: () => overrides.statsError
      ? throwError(() => new Error('stats error'))
      : of(overrides.statsData ?? emptyStats),

    getEvolutionProjets: () => overrides.evolutionError
      ? throwError(() => new Error('evolution error'))
      : of(evolutionStub),

    getRepartitionRoles: () => of(overrides.repartitionData ?? emptyRepartition),

    getAlertes: () => of(overrides.alertesData ?? []),

    getActiviteRecente: () => of(overrides.activitesData ?? []),

    getInsights: () => of(overrides.insightsData ?? insightsStub),

    search: () => of(overrides.searchData ?? searchResultsStub),
  };
}

async function configure(serviceOverrides: Record<string, unknown> = {}) {
  await TestBed.configureTestingModule({
    imports: [AdminDashboardComponent],
    providers: [
      provideRouter([]),
      { provide: AdminDashboardService, useValue: buildService(serviceOverrides) },
    ],
  }).compileComponents();

  const fixture = TestBed.createComponent(AdminDashboardComponent);
  fixture.detectChanges();
  return { fixture, component: fixture.componentInstance };
}

// ── Tests ──────────────────────────────────────────────────────────
describe('AdminDashboardComponent', () => {

  it('should create the component', async () => {
    const { component } = await configure();
    expect(component).toBeTruthy();
  });

  it('should show zero stats when services return empty data', async () => {
    const { component } = await configure({
      statsData: emptyStats,
      alertesData: [],
      activitesData: [],
      insightsData: null
    });
    expect(component.stats.totalCollaborateurs).toBe(0);
    expect(component.stats.projetsActifs).toBe(0);
    expect(component.alertes.length).toBe(0);
  });

  it('should load filled stats from service', async () => {
    const { component } = await configure({ statsData: filledStats });
    expect(component.stats.projetsActifs).toBe(5);
    expect(component.stats.totalCollaborateurs).toBe(20);
    expect(component.stats.projetsEnRetard).toBe(1);
  });

  it('should fall back to mock data when stats service errors', async () => {
    const { component } = await configure({ statsError: true });
    expect(component.stats.projetsActifs).toBe(12);
    expect(component.stats.totalCollaborateurs).toBe(48);
  });

  it('should fall back to mock evolution when service errors', async () => {
    const { component } = await configure({ evolutionError: true });
    expect(component.evolutionData.length).toBe(6);
    expect(component.maxBarValue).toBe(13);
  });

  it('should compute maxBarValue from evolution data', async () => {
    const { component } = await configure();
    expect(component.maxBarValue).toBe(13);
  });

  it('should render alertes when provided', async () => {
    const { component } = await configure({ alertesData: alertesStub });
    expect(component.alertes.length).toBe(2);
    expect(component.alertes[0].type).toBe('danger');
  });

  it('should render activite when provided', async () => {
    const { component } = await configure({ activitesData: activitesStub });
    expect(component.activiteRecente.length).toBe(2);
    expect(component.activiteRecente[0].categorie).toBe('collab');
  });

  it('should expose decision support collections from backend insights', async () => {
    const { component } = await configure({ statsData: filledStats });

    expect(component.platformHealth.score).toBeGreaterThan(0);
    expect(component.criticalProjects.length).toBeGreaterThan(0);
    expect(component.upcomingDeadlines.length).toBeGreaterThan(0);
    expect(component.collaboratorLoad.length).toBeGreaterThan(0);
    expect(component.suggestions.length).toBeGreaterThan(0);
  });

  it('should prefer backend insights when available', async () => {
    const { component } = await configure({ insightsData: insightsStub });

    expect(component.platformHealth.score).toBe(74);
    expect(component.criticalProjects[0].nom).toBe('Programme CRM 360');
    expect(component.collaboratorLoad[0].load).toBe(88);
  });

  it('should return backend search results across projects and users', async () => {
    const { component } = await configure({ statsData: filledStats });

    component.searchTerm = 'crm';
    component.onSearchChange();
    expect(component.searchResults.some((item: { type: string }) => item.type === 'Projet')).toBeTrue();

    component.searchTerm = 'karim';
    component.onSearchChange();
    expect(component.searchResults.some((item: { type: string }) => item.type === 'Utilisateur')).toBeTrue();
  });

  it('should expose activity type helpers', async () => {
    const { component } = await configure({ activitesData: activitesStub });

    expect(component.getTypeClass('CONNEXION')).toBe('connexion');
    expect(component.getTypeIcon('SUPPRESSION')).toBe('ti-trash');
    expect(component.getTypeLabel('ERREUR')).toBe('Erreur');
  });

  it('should compute donut dash correctly', async () => {
    const { component } = await configure({ repartitionData: filledRepartition });
    const total = 38 + 8 + 2;
    const circumference = 2 * Math.PI * 70;
    const expected = (38 / total) * circumference;
    const [dash] = component.getDonutDash(38).split(' ').map(Number);
    expect(Math.round(dash)).toBe(Math.round(expected));
  });

  it('should return safe donut dash when total is zero', async () => {
    const { component } = await configure();
    expect(component.getDonutDash(0)).toBe(`0 ${2 * Math.PI * 70}`);
  });

  it('should compute legend bar percentage correctly', async () => {
    const { component } = await configure({ repartitionData: filledRepartition });
    const pct = component.getLegBarPct(38);
    expect(pct).toBe(Math.round((38 / 48) * 100));
  });

  it('should return 0 for legend bar pct when total is zero', async () => {
    const { component } = await configure();
    expect(component.getLegBarPct(0)).toBe(0);
  });

  it('should set loading to false after data loads', async () => {
    const { component } = await configure();
    expect(component.loading).toBeFalse();
  });

  it('should set loading to false even after stats error', async () => {
    const { component } = await configure({ statsError: true });
    expect(component.loading).toBeFalse();
  });
});