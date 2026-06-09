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
import com.smartassign.pfe.model.AuditLog;
import com.smartassign.pfe.repository.AffectationRepository;
import com.smartassign.pfe.repository.AuditLogRepository;
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
    private final AuditLogRepository auditLogRepository;

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
        List<UpcomingDeadline> upcomingDeadlines = buildUpcomingDeadlines(projets, utilisateurs, today);
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
        long totalProjets = projets.size();
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
            totalProjets,
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
        List<AuditLog> auditLogs = auditLogRepository.findAllByOrderByDateDesc();
        LocalDate today = LocalDate.now();
        LocalDateTime now = LocalDateTime.now();
        List<AlertEntry> entries = new ArrayList<>();

        Map<Long, List<Affectation>> affectationsByProjet = affectations.stream()
            .filter(affectation -> affectation.getProjet() != null && affectation.getProjet().getId() != null)
            .collect(java.util.stream.Collectors.groupingBy(affectation -> affectation.getProjet().getId()));

        Map<Long, List<Affectation>> affectationsByCollaborateur = affectations.stream()
            .filter(affectation -> affectation.getCollaborateur() != null && affectation.getCollaborateur().getId() != null)
            .collect(java.util.stream.Collectors.groupingBy(affectation -> affectation.getCollaborateur().getId()));

        for (Projet projet : projets) {
            if (projet.getId() == null || isTermine(projet.getStatut())) {
                continue;
            }

            List<Affectation> projetAffectations = affectationsByProjet.getOrDefault(projet.getId(), List.of());
            String projectLink = buildProjectLink(projet.getId());

            if (projet.getDateFin() != null && projet.getDateFin().isBefore(today)) {
                entries.add(new AlertEntry(now, buildAlert(
                    "CRITICAL",
                    "Projet " + safeText(projet.getNom()) + " en retard",
                    "Le projet \"" + safeText(projet.getNom()) + "\" est en retard depuis le " + projet.getDateFin() + ".",
                    now,
                    projectLink
                )));
            }

            if (projet.getDateFin() != null) {
                long daysLeft = ChronoUnit.DAYS.between(today, projet.getDateFin());
                if (daysLeft >= 0 && daysLeft < 7) {
                    entries.add(new AlertEntry(now, buildAlert(
                        "WARNING",
                        "Projet " + safeText(projet.getNom()) + " proche de l'echeance",
                        "Le projet \"" + safeText(projet.getNom()) + "\" arrive a echeance dans " + daysLeft + " jour(s).",
                        now,
                        projectLink
                    )));
                }
            }

            if (projetAffectations.isEmpty()) {
                entries.add(new AlertEntry(now, buildAlert(
                    "WARNING",
                    "Projet " + safeText(projet.getNom()) + " sans collaborateurs",
                    "Le projet \"" + safeText(projet.getNom()) + "\" n'a aucun collaborateur affecte.",
                    now,
                    projectLink
                )));
            }

            boolean hasManager = projetAffectations.stream()
                .map(Affectation::getCollaborateur)
                .filter(java.util.Objects::nonNull)
                .map(Collaborateur::getRole)
                .map(this::formatRole)
                .anyMatch("Manager"::equals);

            if (!hasManager) {
                entries.add(new AlertEntry(now, buildAlert(
                    "CRITICAL",
                    "Projet " + safeText(projet.getNom()) + " sans manager responsable",
                    "Le projet \"" + safeText(projet.getNom()) + "\" n'a aucun manager responsable affecte.",
                    now,
                    projectLink
                )));
            }
        }

        for (Collaborateur collaborateur : collaborateurs) {
            if (collaborateur.getId() == null) {
                continue;
            }

            List<Affectation> collabAffectations = affectationsByCollaborateur.getOrDefault(collaborateur.getId(), List.of());
            String collaboratorName = (safeText(collaborateur.getPrenom()) + " " + safeText(collaborateur.getNom())).trim();
            String collaboratorLink = buildCollaborateurLink(collaborateur.getId());

            LocalDateTime lastAssignmentDate = collabAffectations.stream()
                .map(Affectation::getDateAffectation)
                .filter(java.util.Objects::nonNull)
                .max(LocalDateTime::compareTo)
                .orElseGet(() -> resolveUserCreationDate(auditLogs, collaborateur.getEmail(), collaboratorName));

            if (lastAssignmentDate != null && ChronoUnit.DAYS.between(lastAssignmentDate.toLocalDate(), today) > 30) {
                entries.add(new AlertEntry(now, buildAlert(
                    "WARNING",
                    "Collaborateur sans affectation depuis plus de 30 jours",
                    "" + collaboratorName + " n'a pas eu d'affectation recente depuis le " + lastAssignmentDate.toLocalDate() + ".",
                    now,
                    collaboratorLink
                )));
            }

            long activeAssignments = collabAffectations.stream()
                .map(Affectation::getProjet)
                .filter(java.util.Objects::nonNull)
                .filter(projet -> !isTermine(projet.getStatut()))
                .count();
            int loadPercent = Math.toIntExact(activeAssignments * 100);

            if (loadPercent > 100) {
                entries.add(new AlertEntry(now, buildAlert(
                    "CRITICAL",
                    "Collaborateur surcharge (>100%)",
                    collaboratorName + " est a " + loadPercent + "% de capacite sur les projets actifs.",
                    now,
                    collaboratorLink
                )));
            }
        }

        auditLogs.stream()
            .filter(log -> log.getDate() != null)
            .filter(log -> isAction(log, "CREATE_PROJET") || isAction(log, "CREATE_USER") || isAction(log, "ASSIGN"))
            .limit(10)
            .forEach(log -> entries.add(new AlertEntry(log.getDate(), buildAlert(
                "INFO",
                buildAuditCreationTitle(log),
                firstNonBlank(log.getDescription(), "Nouvelle creation enregistree dans le journal d'audit."),
                log.getDate(),
                resolveAuditLink(log)
            ))));

        projets.stream()
            .filter(projet -> isTermine(projet.getStatut()))
            .sorted(Comparator.comparing(Projet::getDateFin, Comparator.nullsLast(Comparator.reverseOrder())))
            .limit(6)
            .forEach(projet -> {
                LocalDateTime ts = projet.getDateFin() == null ? now : projet.getDateFin().atStartOfDay();
                entries.add(new AlertEntry(ts, buildAlert(
                    "INFO",
                    "Projet termine",
                    "Le projet \"" + safeText(projet.getNom()) + "\" est marque termine.",
                    ts,
                    buildProjectLink(projet.getId())
                )));
            });

        return entries.stream()
            .sorted(Comparator.comparing(AlertEntry::timestamp).reversed())
            .map(AlertEntry::alert)
            .toList();
    }

    private Alerte buildAlert(String level, String title, String description, LocalDateTime generatedAt, String link) {
        String normalized = safeText(level).trim().toUpperCase(FRENCH);
        String type = "INFO".equals(normalized) ? "info" : "WARNING".equals(normalized) ? "warning" : "danger";
        String icon = "INFO".equals(normalized) ? "INFO" : "WARNING".equals(normalized) ? "WARNING" : "CRITICAL";
        String generatedAtText = generatedAt == null ? "" : generatedAt.toString();

        return new Alerte(
            type,
            icon,
            title,
            generatedAt == null ? "" : formatRelativeTime(generatedAt),
            title,
            description,
            normalized,
            generatedAtText,
            safeText(link)
        );
    }

    private LocalDateTime resolveUserCreationDate(List<AuditLog> logs, String email, String fullName) {
        String normalizedEmail = safeText(email).trim().toLowerCase(FRENCH);
        String normalizedName = safeText(fullName).trim().toLowerCase(FRENCH);

        return logs.stream()
            .filter(log -> log.getDate() != null)
            .filter(log -> isAction(log, "CREATE_USER"))
            .filter(log -> {
                String target = safeText(log.getTarget()).toLowerCase(FRENCH);
                String description = safeText(log.getDescription()).toLowerCase(FRENCH);
                return (!normalizedEmail.isBlank() && (target.contains(normalizedEmail) || description.contains(normalizedEmail)))
                    || (!normalizedName.isBlank() && (target.contains(normalizedName) || description.contains(normalizedName)));
            })
            .map(AuditLog::getDate)
            .max(LocalDateTime::compareTo)
            .orElse(null);
    }

    private String buildAuditCreationTitle(AuditLog log) {
        if (isAction(log, "CREATE_PROJET")) {
            return "Nouvelle creation de projet";
        }
        if (isAction(log, "CREATE_USER")) {
            return "Nouvelle creation d'utilisateur";
        }
        return "Nouvelle creation d'affectation";
    }

    private String resolveAuditLink(AuditLog log) {
        if (isAction(log, "CREATE_PROJET")) {
            return "/admin/projets";
        }
        if (isAction(log, "CREATE_USER")) {
            return "/admin/collaborateurs";
        }
        return "/admin/affectations";
    }

    private boolean isAction(AuditLog log, String action) {
        return safeText(log.getAction()).trim().equalsIgnoreCase(action);
    }

    public List<Activite> getActiviteRecente() {
        return auditLogRepository.findAllByOrderByDateDesc().stream()
            .filter(log -> log.getDate() != null)
            .sorted(Comparator.comparing(AuditLog::getDate).reversed())
            .map(this::toTimelineActivity)
            .limit(8)
            .toList();
    }

    private Activite toTimelineActivity(AuditLog log) {
        String level = resolveAuditLevel(log);
        String action = buildAuditActionTitle(log);
        String role = normalizeAuditRole(log.getUserRole());

        return new Activite(
            buildAuditInitials(log),
            action,
            formatRelativeTime(log.getDate()),
            resolveAuditCategory(log, level),
            log.getDate().toString(),
            role,
            level,
            resolveTimelineType(log),
            safeText(log.getUser()),
            formatIpForAdmin(log.getIp())
        );
    }

    private String resolveTimelineType(AuditLog log) {
        String action = safeText(log.getAction()).trim().toUpperCase(FRENCH);

        switch (action) {
            case "LOGIN":
            case "LOGOUT":
                return "CONNEXION";
            case "CREATE_USER":
            case "CREATE_PROJET":
                return "CRÉATION";
            case "UPDATE_USER":
            case "UPDATE_PROJET":
            case "ASSIGN":
            case "ROLE_CHANGE":
                return "MODIFICATION";
            case "DELETE_USER":
            case "DELETE_PROJET":
            case "UNASSIGN":
                return "SUPPRESSION";
            case "LOGIN_FAILED":
                return "ERREUR";
            case "PARAMETRES":
                return "PARAMETRES";
            case "RESEND_VERIFICATION":
                return "RENVOI_EMAIL_VERIFICATION";
            default:
                if ("FAILED".equalsIgnoreCase(safeText(log.getStatus()))) {
                    return "ERREUR";
                }
                return "CONNEXION";
        }
    }

    private String buildAuditActionTitle(AuditLog log) {
        String action = safeText(log.getAction()).trim().toUpperCase(FRENCH);
        String target = safeText(log.getTarget()).trim();
        String description = safeText(log.getDescription()).trim();

        switch (action) {
            case "LOGIN":
                return "Connexion réussie";
            case "LOGIN_FAILED":
                return "Tentative de connexion échouée";
            case "LOGOUT":
                return "Déconnexion";
            case "CREATE_USER":
                return "Compte " + normalizeAuditRole(log.getUserRole()) + " créé" + buildTargetSuffix(target, description);
            case "UPDATE_USER":
                return "Modification d'utilisateur" + buildTargetSuffix(target, description);
            case "DELETE_USER":
                return "Suppression d'utilisateur" + buildTargetSuffix(target, description);
            case "CREATE_PROJET":
                return "Projet " + quoteTarget(target, description) + " planifié";
            case "UPDATE_PROJET":
                return "Projet " + quoteTarget(target, description) + " modifié";
            case "DELETE_PROJET":
                return "Projet " + quoteTarget(target, description) + " supprimé";
            case "ASSIGN":
                return "Affectation créée" + buildTargetSuffix(target, description);
            case "UNASSIGN":
                return "Affectation supprimée" + buildTargetSuffix(target, description);
            case "ROLE_CHANGE":
                return "Modification de rôle utilisateur" + buildTargetSuffix(target, description);
            case "RESEND_VERIFICATION":
                return "Renvoi email de vérification" + buildTargetSuffix(target, description);
            default:
                if (!description.isBlank()) {
                    return description;
                }
                return action.isBlank() ? "Événement système" : action;
        }
    }

    private String buildAuditInitials(AuditLog log) {
        String target = safeText(log.getTarget()).trim();

        if (target.contains("@")) {
            String login = target.substring(0, target.indexOf('@')).replace('.', ' ').replace('_', ' ').trim();
            return buildInitialesFromName(login);
        }

        if (!target.isBlank() && !target.startsWith("Projet #") && !target.startsWith("Affectation #")) {
            return buildInitialesFromName(target);
        }

        return buildInitialesFromName(firstNonBlank(log.getUser(), log.getDescription(), log.getAction()));
    }

    private String resolveAuditLevel(AuditLog log) {
        String status = safeText(log.getStatus()).trim().toUpperCase(FRENCH);
        String action = safeText(log.getAction()).trim().toUpperCase(FRENCH);

        if ("FAILED".equals(status) || "LOGIN_FAILED".equals(action)) {
            return "Critique";
        }

        if ("WARNING".equals(status)) {
            return "Warning";
        }

        return "Info";
    }

    private String resolveAuditCategory(AuditLog log, String level) {
        String action = safeText(log.getAction()).trim().toUpperCase(FRENCH);

        if ("LOGIN".equals(action) || "LOGIN_FAILED".equals(action) || "LOGOUT".equals(action)) {
            return "securite";
        }

        if (action.contains("PROJET")) {
            return "projet";
        }

        if (action.contains("ASSIGN")) {
            return "affectation";
        }

        if (level.equals("Critique")) {
            return "incident";
        }

        return "admin";
    }

    private String formatIpForAdmin(String ipRaw) {
        String ip = safeText(ipRaw);
        if (ip.isBlank()) {
            return "-";
        }

        String normalized = ip.toLowerCase(FRENCH);
        if ("127.0.0.1".equals(normalized)
            || "::1".equals(normalized)
            || "0:0:0:0:0:0:0:1".equals(normalized)
            || normalized.startsWith("::ffff:127.")) {
            return "Adresse locale";
        }

        return ip;
    }

    private String normalizeAuditRole(String role) {
        String normalized = safeText(role).trim().toUpperCase(FRENCH);
        if (normalized.contains("ADMIN")) {
            return "ADMIN";
        }
        if (normalized.contains("MANAGER") || normalized.contains("CHEF")) {
            return "MANAGER";
        }
        if (normalized.contains("COLLAB")) {
            return "COLLAB";
        }
        return normalized.isBlank() ? "INCONNU" : normalized;
    }

    private String buildTargetSuffix(String target, String description) {
        if (!target.isBlank()) {
            return " : " + target;
        }
        if (!description.isBlank()) {
            return " : " + description;
        }
        return "";
    }

    private String quoteTarget(String target, String description) {
        String value = firstNonBlank(target, description, "inconnu");
        if (value.startsWith("\"") && value.endsWith("\"")) {
            return value;
        }
        return "\"" + value + "\"";
    }

    private String firstNonBlank(String... values) {
        for (String value : values) {
            if (value != null && !value.isBlank()) {
                return value.trim();
            }
        }
        return "";
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

    private List<UpcomingDeadline> buildUpcomingDeadlines(List<Projet> projets, List<Utilisateur> utilisateurs, LocalDate today) {
        Map<Long, String> managerNomById = utilisateurs.stream()
            .filter(u -> isRole(u.getRole(), "MANAGER"))
            .filter(u -> u.getId() != null && !safeText(u.getNom()).isBlank())
            .collect(java.util.stream.Collectors.toMap(
                Utilisateur::getId,
                u -> safeText(u.getNom()).trim(),
                (a, b) -> a
            ));

        return projets.stream()
            .filter(projet -> !isTermine(projet.getStatut()))
            .map(projet -> {
                long daysLeft = daysLeft(projet.getDateFin(), today);
                String tone = daysLeft <= 3 ? "risk" : daysLeft <= 10 ? "watch" : "good";
                String ownerNom = projet.getManagerId() != null
                    ? managerNomById.getOrDefault(projet.getManagerId(), "Manager à confirmer")
                    : "Manager à confirmer";

                return new UpcomingDeadline(
                    projet.getId(),
                    safeText(projet.getNom()),
                    ownerNom,
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

    @SuppressWarnings("unused")
    private String buildAffectationAction(Affectation affectation) {
        String collaborateurNom = affectation.getCollaborateur() == null
            ? "Collaborateur inconnu"
            : (safeText(affectation.getCollaborateur().getPrenom()) + " " + safeText(affectation.getCollaborateur().getNom())).trim();
        String projetNom = affectation.getProjet() == null ? "Projet inconnu" : safeText(affectation.getProjet().getNom());
        return "Affectation mise a jour : " + collaborateurNom + " -> " + projetNom;
    }

    @SuppressWarnings("unused")
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

    private record AlertEntry(LocalDateTime timestamp, Alerte alert) {
    }

}