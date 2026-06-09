export {
	AdminDashboardService,
	type Activite,
	type Alerte,
	type CollaboratorLoad,
	type CriticalProject,
	type DashboardInsights,
	type DashboardStats,
	type EvolutionMois,
	type HealthFactor,
	type PlatformHealth,
	type RepartitionRoles,
	type SearchResult,
	type Suggestion,
	type UpcomingDeadline,
} from './dashboard.service';
export {
	AdminCollaborateurService,
	type Collaborateur,
	type CollaborateurRequest,
} from './collaborateur.service';
export {
	AdminProjetService,
	type Projet,
	type ProjetRequest,
	type StatutProjet,
} from './projet.service';
export {
	AdminReportsService,
	type SystemReport,
	type SystemReportComptes,
	type SystemReportConnexions,
	type SystemReportAffectation,
	type SystemReportProjets,
	type SystemReportSante,
	type EvolutionMoisReport,
	type RepartitionDept,
} from './reports.service';
export {
	AdminRolesService,
	type AdminRole,
	type RoleMember,
	type RolePermission,
} from './roles.service';
