package com.smartassign.pfe.service;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.YearMonth;
import java.time.format.TextStyle;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.smartassign.pfe.dto.AdminDashboardDto.Activite;
import com.smartassign.pfe.dto.AdminDashboardDto.Alerte;
import com.smartassign.pfe.dto.AdminDashboardDto.CollaboratorLoad;
import com.smartassign.pfe.dto.AdminDashboardDto.CriticalProject;
import com.smartassign.pfe.dto.AdminDashboardDto.DashboardInsights;
import com.smartassign.pfe.dto.AdminDashboardDto.DashboardStats;
import com.smartassign.pfe.dto.AdminDashboardDto.EvolutionMois;
import com.smartassign.pfe.dto.AdminDashboardDto.HealthFactor;
import com.smartassign.pfe.dto.AdminDashboardDto.PlatformHealth;
import com.smartassign.pfe.dto.AdminDashboardDto.RepartitionRoles;
import com.smartassign.pfe.dto.AdminDashboardDto.SearchResult;
import com.smartassign.pfe.dto.AdminDashboardDto.Suggestion;
import com.smartassign.pfe.dto.AdminDashboardDto.UpcomingDeadline;
import com.smartassign.pfe.entity.Affectation;
import com.smartassign.pfe.entity.Collaborateur;
import com.smartassign.pfe.entity.Projet;
import com.smartassign.pfe.entity.Utilisateur;
import com.smartassign.pfe.repository.AffectationRepository;
import com.smartassign.pfe.repository.CollaborateurRepository;
import com.smartassign.pfe.repository.ProjetRepository;
import com.smartassign.pfe.repository.UtilisateurRepository;

import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class AdminDashboardServiceImpl implements AdminDashboardService {

    private static final Locale FRENCH = Locale.FRENCH;

    private final ProjetRepository projetRepository;
    private final CollaborateurRepository collaborateurRepository;
    private final UtilisateurRepository utilisateurRepository;
    private final AffectationRepository affectationRepository;

    public DashboardStats getStats() {
        List<Projet> projets = projetRepository.findAll();
        List<Collaborateur> collaborateurs = collaborateurRepository.findAll();
        List<Utilisateur> utilisateurs = utilisateurRepository.findAll();
        List<Affectation> affectations = affectationRepository.findAll();
        LocalDate today = LocalDate.now();

        return computeStats(projets, collaborateurs, utilisateurs, affectations, today);
    }

    public DashboardInsights getInsights() {
        List<Projet> projets = projetRepository.findAll();
        List<Collaborateur> collaborateurs = collaborateurRepository.findAll();
        List<Utilisateur> utilisateurs = utilisateurRepository.findAll();
        List<Affectation> affectations = affectationRepository.findAll();
        LocalDate today = LocalDate.now();
        DashboardStats stats = computeStats(projets, collaborateurs, utilisateurs, affectations, today);
        List<CollaboratorLoad> collaboratorLoad = buildCollaboratorLoad(collaborateurs, affectations);
        List<CriticalProject> criticalProjects = buildCriticalProjects(projets, affectations, today);
        List<UpcomingDeadline> upcomingDeadlines = buildUpcomingDeadlines(projets, today);
        PlatformHealth platformHealth = buildPlatformHealth(stats, criticalProjects, upcomingDeadlines, collaboratorLoad);
        List<Suggestion> suggestions = buildSuggestions(stats, criticalProjects, upcomingDeadlines, collaboratorLoad, platformHealth);

        return new DashboardInsights(platformHealth, criticalProjects, upcomingDeadlines, collaboratorLoad, suggestions);
    }

    public List<SearchResult> search(String query) {
        String normalizedQuery = safeText(query).trim().toLowerCase(FRENCH);
        if (normalizedQuery.isBlank()) {
            return List.of();
        }

        List<SearchResult> results = new ArrayList<>();

        projetRepository.findAll().stream()
            .filter(projet -> containsSearchText(normalizedQuery, projet.getNom(), projet.getDescription(), projet.getStatut()))
            .limit(5)
            .forEach(projet -> results.add(new SearchResult(
                "Projet",
                safeText(projet.getNom()),
                formatProjectStatus(projet.getStatut()) + " • echeance " + formatDeadlineLabel(daysLeft(projet.getDateFin(), LocalDate.now())),
                buildProjectLink(projet.getId())
            )));

        collaborateurRepository.findAll().stream()
            .filter(collaborateur -> containsSearchText(
                normalizedQuery,
                collaborateur.getPrenom(),
                collaborateur.getNom(),
                collaborateur.getEmail(),
                formatRole(collaborateur.getRole()),
                buildSkillsSummary(collaborateur)
            ))
            .limit(5)
            .forEach(collaborateur -> results.add(new SearchResult(
                "Utilisateur",
                (safeText(collaborateur.getPrenom()) + " " + safeText(collaborateur.getNom())).trim(),
                formatRole(collaborateur.getRole()) + " • " + safeText(collaborateur.getEmail()),
                buildCollaborateurLink(collaborateur.getId())
            )));

        utilisateurRepository.findAll().stream()
            .filter(utilisateur -> containsSearchText(normalizedQuery, utilisateur.getNom(), utilisateur.getEmail(), formatRole(utilisateur.getRole())))
            .limit(3)
            .forEach(utilisateur -> results.add(new SearchResult(
                "Utilisateur",
                safeText(utilisateur.getNom()),
                formatRole(utilisateur.getRole()) + " • " + safeText(utilisateur.getEmail()),
                "/admin/profil"
            )));

        return results.stream().limit(8).toList();
    }

    private DashboardStats computeStats(
        List<Projet> projets,
        List<Collaborateur> collaborateurs,
        List<Utilisateur> utilisateurs,
        List<Affectation> affectations,
        LocalDate today
    ) {

        long projetsActifs = projets.stream()
            .filter(this::isProjetActif)
            .count();
        long totalCollaborateurs = collaborateurs.size();
        long totalManagers = utilisateurs.stream()
            .filter(utilisateur -> isRole(utilisateur.getRole(), "MANAGER"))
            .count();
        long projetsEnRetard = projets.stream()
            .filter(projet -> isProjetEnRetard(projet, today))
            .count();
        long ressourcesDisponibles = collaborateurs.stream()
            .filter(Collaborateur::isDisponible)
            .count();
        long nouveauxProjets = projets.stream()
            .filter(projet -> projet.getDateDebut() != null && !projet.getDateDebut().isBefore(today.minusDays(30)))
            .count();

        Set<Long> collaborateursAffectes = new LinkedHashSet<>();
        for (Affectation affectation : affectations) {
            if (affectation.getCollaborateur() != null && affectation.getCollaborateur().getId() != null) {
                collaborateursAffectes.add(affectation.getCollaborateur().getId());
            }
        }

        long tauxAffectation = totalCollaborateurs == 0
            ? 0
            : Math.round((collaborateursAffectes.size() * 100.0) / totalCollaborateurs);
        long managersActifs = projetsActifs == 0 ? 0 : totalManagers;
        long nouveauxCollabs = Math.max(0, totalCollaborateurs - collaborateursAffectes.size());

        return new DashboardStats(
            projetsActifs,
            totalCollaborateurs,
            tauxAffectation,
            managersActifs,
            totalManagers,
            projetsEnRetard,
            ressourcesDisponibles,
            nouveauxProjets,
            nouveauxCollabs
        );
    }

    public List<EvolutionMois> getEvolutionProjets() {
        List<Projet> projets = projetRepository.findAll();
        List<EvolutionMois> evolution = new ArrayList<>();
        YearMonth currentMonth = YearMonth.now();

        for (int offset = 5; offset >= 0; offset--) {
            YearMonth month = currentMonth.minusMonths(offset);
            LocalDate monthStart = month.atDay(1);
            LocalDate monthEnd = month.atEndOfMonth();

            long actifs = projets.stream()
                .filter(projet -> overlapsMonth(projet, monthStart, monthEnd))
                .count();
            long termines = projets.stream()
                .filter(projet -> projet.getDateFin() != null)
                .filter(projet -> YearMonth.from(projet.getDateFin()).equals(month))
                .filter(projet -> isTermine(projet.getStatut()))
                .count();

            evolution.add(new EvolutionMois(
                capitalize(month.getMonth().getDisplayName(TextStyle.SHORT, FRENCH)),
                actifs,
                termines
            ));
        }

        return evolution;
    }

    public RepartitionRoles getRepartitionRoles() {
        Map<String, Long> countsByRole = utilisateurRepository.findAll().stream()
            .collect(java.util.stream.Collectors.groupingBy(
                utilisateur -> normalizeRole(utilisateur.getRole()),
                java.util.stream.Collectors.counting()
            ));

        return new RepartitionRoles(
            countsByRole.getOrDefault("COLLAB", 0L),
            countsByRole.getOrDefault("MANAGER", 0L),
            countsByRole.getOrDefault("ADMIN", 0L)
        );
    }

    public List<Alerte> getAlertes() {
        List<Projet> projets = projetRepository.findAll();
        List<Collaborateur> collaborateurs = collaborateurRepository.findAll();
        List<Affectation> affectations = affectationRepository.findAll();
        LocalDate today = LocalDate.now();
        List<Alerte> alertes = new ArrayList<>();

        long projetsEnRetard = projets.stream()
            .filter(projet -> isProjetEnRetard(projet, today))
            .count();
        if (projetsEnRetard > 0) {
            alertes.add(new Alerte(
                "danger",
                "🔴",
                projetsEnRetard + (projetsEnRetard == 1 ? " projet depasse la date limite" : " projets depassent la date limite"),
                "aujourd'hui"
            ));
        }

        Set<Long> collaborateursAffectes = new LinkedHashSet<>();
        for (Affectation affectation : affectations) {
            if (affectation.getCollaborateur() != null && affectation.getCollaborateur().getId() != null) {
                collaborateursAffectes.add(affectation.getCollaborateur().getId());
            }
        }

        long nonAffectes = collaborateurs.stream()
            .filter(collaborateur -> collaborateur.getId() != null)
            .filter(collaborateur -> !collaborateursAffectes.contains(collaborateur.getId()))
            .count();
        if (nonAffectes > 0) {
            alertes.add(new Alerte(
                "warning",
                "🟡",
                nonAffectes + (nonAffectes == 1 ? " collaborateur est sans affectation" : " collaborateurs sont sans affectation"),
                "aujourd'hui"
            ));
        }

        long indisponibles = collaborateurs.stream()
            .filter(collaborateur -> !collaborateur.isDisponible())
            .count();
        if (indisponibles > 0) {
            alertes.add(new Alerte(
                "info",
                "🔵",
                indisponibles + (indisponibles == 1 ? " ressource est actuellement indisponible" : " ressources sont actuellement indisponibles"),
                "aujourd'hui"
            ));
        }

        if (alertes.isEmpty()) {
            alertes.add(new Alerte("info", "🟢", "Aucune alerte critique pour le moment", "a l'instant"));
        }

        return alertes;
    }

    public List<Activite> getActiviteRecente() {
        List<ActiviteEntry> entries = new ArrayList<>();

        affectationRepository.findAllOrderByDateDesc().stream()
            .limit(4)
            .forEach(affectation -> entries.add(new ActiviteEntry(
                affectation.getDateAffectation(),
                new Activite(
                    buildInitiales(affectation.getCollaborateur() == null ? null : affectation.getCollaborateur().getPrenom(),
                        affectation.getCollaborateur() == null ? null : affectation.getCollaborateur().getNom()),
                    buildAffectationAction(affectation),
                    formatRelativeTime(affectation.getDateAffectation()),
                    "collab"
                )
            )));

        projetRepository.findAll().stream()
            .filter(projet -> projet.getDateDebut() != null)
            .sorted(Comparator.comparing(Projet::getDateDebut).reversed())
            .limit(2)
            .forEach(projet -> entries.add(new ActiviteEntry(
                projet.getDateDebut().atStartOfDay(),
                new Activite(
                    buildInitialesFromName(projet.getNom()),
                    "Projet \"" + projet.getNom() + "\" planifie",
                    formatRelativeTime(projet.getDateDebut().atStartOfDay()),
                    "projet"
                )
            )));

        utilisateurRepository.findAll().stream()
            .sorted(Comparator.comparing(Utilisateur::getId, Comparator.nullsLast(Comparator.reverseOrder())))
            .limit(2)
            .forEach(utilisateur -> entries.add(new ActiviteEntry(
                LocalDateTime.now().minusHours(Math.max(1L, utilisateur.getId() == null ? 1L : utilisateur.getId())),
                new Activite(
                    buildInitialesFromName(utilisateur.getNom()),
                    "Compte " + utilisateur.getRole() + " actif : " + utilisateur.getNom(),
                    "recentement",
                    "admin"
                )
            )));

        return entries.stream()
            .sorted(Comparator.comparing(ActiviteEntry::timestamp).reversed())
            .map(ActiviteEntry::activite)
            .limit(6)
            .toList();
    }

    private List<CriticalProject> buildCriticalProjects(List<Projet> projets, List<Affectation> affectations, LocalDate today) {
        Map<Long, List<Affectation>> affectationsByProjet = affectations.stream()
            .filter(affectation -> affectation.getProjet() != null && affectation.getProjet().getId() != null)
            .collect(java.util.stream.Collectors.groupingBy(affectation -> affectation.getProjet().getId()));

        return projets.stream()
            .filter(projet -> !isTermine(projet.getStatut()))
            .map(projet -> {
                List<Affectation> projetAffectations = affectationsByProjet.getOrDefault(projet.getId(), List.of());
                long daysLeft = daysLeft(projet.getDateFin(), today);
                int charge = estimateProjectCharge(projet, projetAffectations, today);
                String tone = resolveOperationalTone(daysLeft, charge, isProjetEnRetard(projet, today));

                return new CriticalProject(
                    projet.getId(),
                    safeText(projet.getNom()),
                    buildProjectOwner(projetAffectations),
                    formatProjectStatus(projet.getStatut()),
                    charge,
                    projetAffectations.size(),
                    roundAverageScore(projetAffectations),
                    daysLeft,
                    describeProjectRisk(projet, daysLeft, charge, today),
                    buildProjectRecommendation(projet, daysLeft, charge, today),
                    buildProjectLink(projet.getId()),
                    tone
                );
            })
            .filter(project -> !"good".equals(project.tone()))
            .sorted(Comparator
                .comparingInt((CriticalProject project) -> riskWeight(project.tone())).reversed()
                .thenComparingLong(CriticalProject::daysLeft)
                .thenComparing(Comparator.comparingInt(CriticalProject::charge).reversed()))
            .limit(4)
            .toList();
    }

    private List<UpcomingDeadline> buildUpcomingDeadlines(List<Projet> projets, LocalDate today) {
        return projets.stream()
            .filter(projet -> !isTermine(projet.getStatut()))
            .map(projet -> {
                long daysLeft = daysLeft(projet.getDateFin(), today);
                String tone = daysLeft <= 3 ? "risk" : daysLeft <= 10 ? "watch" : "good";

                return new UpcomingDeadline(
                    projet.getId(),
                    safeText(projet.getNom()),
                    "Pilotage a confirmer",
                    formatDeadlineLabel(daysLeft),
                    daysLeft,
                    tone,
                    buildProjectLink(projet.getId())
                );
            })
            .sorted(Comparator.comparingLong(UpcomingDeadline::daysLeft))
            .limit(5)
            .toList();
    }

    private List<CollaboratorLoad> buildCollaboratorLoad(List<Collaborateur> collaborateurs, List<Affectation> affectations) {
        Map<Long, List<Affectation>> affectationsByCollaborateur = affectations.stream()
            .filter(affectation -> affectation.getCollaborateur() != null && affectation.getCollaborateur().getId() != null)
            .collect(java.util.stream.Collectors.groupingBy(affectation -> affectation.getCollaborateur().getId()));

        return collaborateurs.stream()
            .map(collaborateur -> {
                List<Affectation> collaborateurAffectations = affectationsByCollaborateur.getOrDefault(collaborateur.getId(), List.of());
                int load = estimateCollaboratorLoad(collaborateur, collaborateurAffectations);
                String tone = load >= 85 ? "risk" : load >= 65 ? "watch" : "good";

                return new CollaboratorLoad(
                    collaborateur.getId(),
                    (safeText(collaborateur.getPrenom()) + " " + safeText(collaborateur.getNom())).trim(),
                    formatRole(collaborateur.getRole()),
                    load,
                    collaborateurAffectations.size(),
                    (int) activeAssignments(collaborateurAffectations),
                    collaborateur.isDisponible() ? "Disponible" : "Indisponible",
                    buildSkillsSummary(collaborateur),
                    tone,
                    buildCollaborateurLink(collaborateur.getId())
                );
            })
            .sorted(Comparator.comparingInt(CollaboratorLoad::load).reversed())
            .limit(6)
            .toList();
    }

    private PlatformHealth buildPlatformHealth(
        DashboardStats stats,
        List<CriticalProject> criticalProjects,
        List<UpcomingDeadline> upcomingDeadlines,
        List<CollaboratorLoad> collaboratorLoad
    ) {
        long activeProjects = Math.max(1L, stats.projetsActifs());
        double delayedRatio = stats.projetsEnRetard() / (double) activeProjects;
        double availableRatio = stats.ressourcesDisponibles() / (double) Math.max(1L, stats.totalCollaborateurs());
        long overloadedCount = collaboratorLoad.stream().filter(item -> item.load() >= 85).count();
        double overloadedRatio = overloadedCount / (double) Math.max(1, collaboratorLoad.size());
        long urgentDeadlines = upcomingDeadlines.stream().filter(item -> item.daysLeft() <= 7).count();
        int allocationGap = (int) Math.abs(stats.tauxAffectation() - 72);

        int deliveryScore = clamp((int) Math.round(100 - delayedRatio * 120), 0, 100);
        int deadlineScore = clamp((int) Math.round(100 - (urgentDeadlines * 14)), 0, 100);
        int allocationScore = clamp((int) Math.round(100 - allocationGap * 2.4), 0, 100);
        int capacityScore = clamp((int) Math.round(45 + availableRatio * 85 - overloadedRatio * 25), 0, 100);
        int score = (int) Math.round(
            (deliveryScore * 0.30) +
            (deadlineScore * 0.20) +
            (allocationScore * 0.25) +
            (capacityScore * 0.25)
        );
        String tone = resolveScoreTone(score);
        String label = "good".equals(tone)
            ? "Plateforme saine"
            : "watch".equals(tone)
                ? "Sous surveillance"
                : "Attention prioritaire";

        List<HealthFactor> factors = List.of(
            new HealthFactor("Execution projet", deliveryScore, resolveScoreTone(deliveryScore), stats.projetsEnRetard() + " projet(s) en retard"),
            new HealthFactor("Deadlines proches", deadlineScore, resolveScoreTone(deadlineScore), urgentDeadlines + " echeance(s) sous 7 jours"),
            new HealthFactor("Affectation", allocationScore, resolveScoreTone(allocationScore), stats.tauxAffectation() + "% de mobilisation globale"),
            new HealthFactor("Capacite disponible", capacityScore, resolveScoreTone(capacityScore), stats.ressourcesDisponibles() + " ressource(s) mobilisable(s)")
        );

        return new PlatformHealth(score, label, buildHealthSummary(score, criticalProjects, overloadedCount), tone, factors);
    }

    private List<Suggestion> buildSuggestions(
        DashboardStats stats,
        List<CriticalProject> criticalProjects,
        List<UpcomingDeadline> upcomingDeadlines,
        List<CollaboratorLoad> collaboratorLoad,
        PlatformHealth platformHealth
    ) {
        List<Suggestion> suggestions = new ArrayList<>();
        long availableResources = collaboratorLoad.stream().filter(item -> "Disponible".equals(item.availabilityLabel())).count();
        long overloaded = collaboratorLoad.stream().filter(item -> item.load() >= 85).count();
        long urgentDeadlines = upcomingDeadlines.stream().filter(item -> item.daysLeft() <= 7).count();

        if (!criticalProjects.isEmpty() && availableResources > 0) {
            CriticalProject project = criticalProjects.get(0);
            suggestions.add(new Suggestion(
                "Reaffecter rapidement des ressources",
                availableResources + " ressource(s) disponible(s) peuvent soulager " + project.nom() + ".",
                "Ouvrir les affectations",
                "/admin/affectation",
                "risk"
            ));
        }

        if (overloaded > 0) {
            suggestions.add(new Suggestion(
                "Reequilibrer la charge equipe",
                overloaded + " collaborateur(s) depassent la charge recommandee.",
                "Voir les collaborateurs",
                "/admin/collaborateurs",
                "watch"
            ));
        }

        if (urgentDeadlines > 0) {
            suggestions.add(new Suggestion(
                "Passer en revue les echeances de la semaine",
                urgentDeadlines + " projet(s) arrivent a maturite et demandent un arbitrage planning.",
                "Voir les projets",
                "/admin/projets",
                "watch"
            ));
        }

        if (platformHealth.score() < 70) {
            suggestions.add(new Suggestion(
                "Renforcer le pilotage portefeuille",
                "Le score global indique des tensions qui meritent un suivi plus frequent.",
                "Retour au dashboard",
                "/admin/dashboard",
                "risk"
            ));
        }

        if (suggestions.isEmpty()) {
            suggestions.add(new Suggestion(
                "Maintenir le rythme actuel",
                "Les indicateurs sont stables. Continuez les revues courtes et les arbitrages ponctuels.",
                "Voir le portefeuille",
                "/admin/projets",
                "good"
            ));
        }

        return suggestions.stream().limit(4).toList();
    }

    private int estimateProjectCharge(Projet projet, List<Affectation> affectations, LocalDate today) {
        double averageScore = affectations.stream().mapToDouble(Affectation::getScore).average().orElse(55.0);
        long daysLeft = daysLeft(projet.getDateFin(), today);
        int charge = (int) Math.round((affectations.size() * 18) + (averageScore * 0.45));

        if (isProjetEnRetard(projet, today)) {
            charge += 22;
        } else if (daysLeft <= 7) {
            charge += 14;
        } else if (daysLeft <= 14) {
            charge += 8;
        }

        if ("EN_PAUSE".equals(normalizeStatut(projet.getStatut()))) {
            charge += 6;
        }

        if (affectations.isEmpty()) {
            charge += 10;
        }

        return clamp(charge, 20, 100);
    }

    private int estimateCollaboratorLoad(Collaborateur collaborateur, List<Affectation> affectations) {
        long activeAssignments = activeAssignments(affectations);
        double averageScore = affectations.stream().mapToDouble(Affectation::getScore).average().orElse(collaborateur.isDisponible() ? 40.0 : 65.0);
        int competences = collaborateur.getCompetences() == null ? 0 : collaborateur.getCompetences().size();
        int load = (int) Math.round((activeAssignments * 26) + (averageScore * 0.35) + (competences * 4));

        if (!collaborateur.isDisponible()) {
            load += 15;
        }

        load += Math.min(collaborateur.getExperienceAnnees() * 2, 16);
        return clamp(load, 12, 100);
    }

    private long activeAssignments(List<Affectation> affectations) {
        return affectations.stream()
            .filter(affectation -> affectation.getProjet() != null && isProjetActif(affectation.getProjet()))
            .count();
    }

    private double roundAverageScore(List<Affectation> affectations) {
        double average = affectations.stream().mapToDouble(Affectation::getScore).average().orElse(0.0);
        return Math.round(average * 10.0) / 10.0;
    }

    private String buildProjectOwner(List<Affectation> affectations) {
        return affectations.stream()
            .map(Affectation::getCollaborateur)
            .filter(java.util.Objects::nonNull)
            .map(collaborateur -> (safeText(collaborateur.getPrenom()) + " " + safeText(collaborateur.getNom())).trim())
            .filter(value -> !value.isBlank())
            .findFirst()
            .orElse("Pilotage a confirmer");
    }

    private String describeProjectRisk(Projet projet, long daysLeft, int charge, LocalDate today) {
        if (isProjetEnRetard(projet, today)) {
            return "Retard constate sur le portefeuille, action immediate recommandee.";
        }
        if (daysLeft <= 3) {
            return "Deadline tres proche avec marge de manoeuvre reduite.";
        }
        if (charge >= 85) {
            return "Charge elevee sur le projet, risque de saturation de l'equipe.";
        }
        return "Projet a surveiller pour maintenir le rythme d'execution.";
    }

    private String buildProjectRecommendation(Projet projet, long daysLeft, int charge, LocalDate today) {
        if (isProjetEnRetard(projet, today) || charge >= 90) {
            return "Reallouer des ressources et verrouiller un plan de rattrapage.";
        }
        if (daysLeft <= 7) {
            return "Confirmer le jalon de fin avec une revue planning rapide.";
        }
        return "Maintenir une revue hebdomadaire des dependances et de la capacite.";
    }

    private String buildSkillsSummary(Collaborateur collaborateur) {
        if (collaborateur.getCompetences() == null || collaborateur.getCompetences().isEmpty()) {
            return "Competences non renseignees";
        }

        return collaborateur.getCompetences().stream()
            .map(competence -> safeText(competence.getNom()))
            .filter(value -> !value.isBlank())
            .limit(3)
            .collect(java.util.stream.Collectors.joining(" • "));
    }

    private boolean containsSearchText(String normalizedQuery, String... values) {
        String haystack = java.util.Arrays.stream(values)
            .map(this::safeText)
            .map(value -> value.toLowerCase(FRENCH))
            .collect(java.util.stream.Collectors.joining(" "));

        return haystack.contains(normalizedQuery);
    }

    private String buildHealthSummary(int score, List<CriticalProject> criticalProjects, long overloadedCount) {
        if (score >= 75) {
            return "Les indicateurs sont globalement maitrises. Le pilotage peut se concentrer sur l'optimisation et l'anticipation.";
        }
        if (score >= 55) {
            return "Le portefeuille reste pilotable mais des tensions existent sur les projets sensibles et la charge equipe.";
        }
        return "Le dashboard detecte une pression reelle sur les delais et la capacite. Priorisez les arbitrages immediats sur "
            + (criticalProjects.isEmpty() ? "le portefeuille" : criticalProjects.get(0).nom())
            + " et les " + overloadedCount + " surcharge(s) en cours.";
    }

    private String formatProjectStatus(String statut) {
        return switch (normalizeStatut(statut)) {
            case "EN_COURS" -> "En cours";
            case "EN_ATTENTE" -> "En attente";
            case "EN_PAUSE" -> "En pause";
            case "EN_RETARD" -> "En retard";
            case "TERMINE" -> "Termine";
            default -> "A qualifier";
        };
    }

    private String formatRole(String role) {
        return switch (normalizeRole(role)) {
            case "ADMIN" -> "Admin";
            case "MANAGER" -> "Manager";
            default -> "Collaborateur";
        };
    }

    private String formatDeadlineLabel(long daysLeft) {
        if (daysLeft < 0) {
            return "Retard de " + Math.abs(daysLeft) + " j";
        }
        if (daysLeft == 0) {
            return "Aujourd'hui";
        }
        if (daysLeft == 1) {
            return "Demain";
        }
        return daysLeft + " jours";
    }

    private long daysLeft(LocalDate endDate, LocalDate today) {
        if (endDate == null) {
            return Long.MAX_VALUE;
        }
        return ChronoUnit.DAYS.between(today, endDate);
    }

    private String buildProjectLink(Long projetId) {
        return projetId == null ? "/admin/projets" : "/admin/projets/edit/" + projetId;
    }

    private String buildCollaborateurLink(Long collaborateurId) {
        return collaborateurId == null ? "/admin/collaborateurs" : "/admin/collaborateurs/edit/" + collaborateurId;
    }

    private String resolveOperationalTone(long daysLeft, int charge, boolean delayed) {
        if (delayed || charge >= 85 || daysLeft <= 3) {
            return "risk";
        }
        if (charge >= 70 || daysLeft <= 10) {
            return "watch";
        }
        return "good";
    }

    private String resolveScoreTone(int score) {
        if (score >= 75) {
            return "good";
        }
        if (score >= 55) {
            return "watch";
        }
        return "risk";
    }

    private int riskWeight(String tone) {
        return switch (tone) {
            case "risk" -> 3;
            case "watch" -> 2;
            default -> 1;
        };
    }

    private int clamp(int value, int min, int max) {
        return Math.max(min, Math.min(max, value));
    }

    private boolean overlapsMonth(Projet projet, LocalDate monthStart, LocalDate monthEnd) {
        if (projet.getDateDebut() == null || projet.getDateFin() == null) {
            return false;
        }

        return !projet.getDateDebut().isAfter(monthEnd) && !projet.getDateFin().isBefore(monthStart);
    }

    private boolean isProjetActif(Projet projet) {
        String statut = normalizeStatut(projet.getStatut());
        return "EN_COURS".equals(statut) || "EN_ATTENTE".equals(statut) || "EN_PAUSE".equals(statut);
    }

    private boolean isProjetEnRetard(Projet projet, LocalDate today) {
        return projet.getDateFin() != null && projet.getDateFin().isBefore(today) && !isTermine(projet.getStatut());
    }

    private boolean isTermine(String statut) {
        return "TERMINE".equals(normalizeStatut(statut));
    }

    private String normalizeStatut(String statut) {
        if (statut == null) {
            return "";
        }

        return statut.trim().toUpperCase(FRENCH)
            .replace('É', 'E')
            .replace('-', '_');
    }

    private boolean isRole(String role, String expected) {
        return expected.equals(normalizeRole(role));
    }

    private String normalizeRole(String role) {
        if (role == null) {
            return "COLLAB";
        }

        String normalizedRole = role.trim().toUpperCase(FRENCH);
        if (normalizedRole.contains("ADMIN")) {
            return "ADMIN";
        }
        if (normalizedRole.contains("MANAGER") || normalizedRole.contains("CHEF")) {
            return "MANAGER";
        }
        return "COLLAB";
    }

    private String buildAffectationAction(Affectation affectation) {
        String collaborateurNom = affectation.getCollaborateur() == null
            ? "Collaborateur inconnu"
            : (safeText(affectation.getCollaborateur().getPrenom()) + " " + safeText(affectation.getCollaborateur().getNom())).trim();
        String projetNom = affectation.getProjet() == null ? "Projet inconnu" : safeText(affectation.getProjet().getNom());
        return "Affectation mise a jour : " + collaborateurNom + " -> " + projetNom;
    }

    private String buildInitiales(String prenom, String nom) {
        String initials = (safeText(prenom).isBlank() ? "" : safeText(prenom).substring(0, 1))
            + (safeText(nom).isBlank() ? "" : safeText(nom).substring(0, 1));
        return initials.isBlank() ? "SA" : initials.toUpperCase(FRENCH);
    }

    private String buildInitialesFromName(String value) {
        String[] parts = safeText(value).trim().split("\\s+");
        StringBuilder initials = new StringBuilder();

        for (String part : parts) {
            if (!part.isBlank()) {
                initials.append(Character.toUpperCase(part.charAt(0)));
            }
            if (initials.length() == 2) {
                break;
            }
        }

        return initials.isEmpty() ? "SA" : initials.toString();
    }

    private String safeText(String value) {
        return value == null ? "" : value;
    }

    private String formatRelativeTime(LocalDateTime timestamp) {
        if (timestamp == null) {
            return "recentement";
        }

        long minutes = Math.max(0, ChronoUnit.MINUTES.between(timestamp, LocalDateTime.now()));
        if (minutes < 1) {
            return "a l'instant";
        }
        if (minutes < 60) {
            return "il y a " + minutes + " min";
        }

        long hours = ChronoUnit.HOURS.between(timestamp, LocalDateTime.now());
        if (hours < 24) {
            return "il y a " + hours + " h";
        }

        long days = ChronoUnit.DAYS.between(timestamp.toLocalDate(), LocalDate.now());
        if (days <= 1) {
            return "hier";
        }

        return "il y a " + days + " j";
    }

    private String capitalize(String value) {
        if (value == null || value.isBlank()) {
            return "";
        }

        return value.substring(0, 1).toUpperCase(FRENCH) + value.substring(1);
    }

    private record ActiviteEntry(LocalDateTime timestamp, Activite activite) {
    }
}