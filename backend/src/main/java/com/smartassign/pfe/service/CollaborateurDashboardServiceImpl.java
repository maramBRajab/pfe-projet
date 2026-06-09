package com.smartassign.pfe.service;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.stream.Collectors;

import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import com.smartassign.pfe.dto.CollaborateurDashboardDto;
import com.smartassign.pfe.entity.Affectation;
import com.smartassign.pfe.entity.Collaborateur;
import com.smartassign.pfe.entity.Conge;
import com.smartassign.pfe.entity.JournalRh;
import com.smartassign.pfe.entity.Tache;
import com.smartassign.pfe.exception.ResourceNotFoundException;
import com.smartassign.pfe.model.AuditLog;
import com.smartassign.pfe.repository.AffectationRepository;
import com.smartassign.pfe.repository.AuditLogRepository;
import com.smartassign.pfe.repository.CollaborateurRepository;
import com.smartassign.pfe.repository.CongeRepository;
import com.smartassign.pfe.repository.JournalRhRepository;
import com.smartassign.pfe.repository.TacheRepository;

import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class CollaborateurDashboardServiceImpl implements CollaborateurDashboardService {

    private static final Locale FRENCH = Locale.FRENCH;
    private static final DateTimeFormatter DATE_FORMAT = DateTimeFormatter.ofPattern("dd/MM/yyyy", FRENCH);
    private static final DateTimeFormatter DATE_TIME_FORMAT = DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm", FRENCH);

    private final CollaborateurRepository collaborateurRepository;
    private final AffectationRepository affectationRepository;
    private final TacheRepository tacheRepository;
    private final CongeRepository congeRepository;
    private final AuditLogRepository auditLogRepository;
    private final JournalRhRepository journalRhRepository;

    @Override
    public CollaborateurDashboardDto.Response getDashboard(Long requestedCollaborateurId, String authenticatedEmail) {
        String securityEmail = getAuthenticatedEmailFromContext();
        String normalizedEmail = normalizeEmail(securityEmail.isBlank() ? authenticatedEmail : securityEmail);
        if (normalizedEmail.isBlank()) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Session utilisateur invalide.");
        }

        Collaborateur connectedCollaborateur = collaborateurRepository.findByEmailIgnoreCase(normalizedEmail)
            .orElseThrow(() -> new ResourceNotFoundException("Collaborateur introuvable pour l'email : " + normalizedEmail));

        if (!Objects.equals(connectedCollaborateur.getId(), requestedCollaborateurId)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Acces refuse au dashboard de ce collaborateur.");
        }

        List<Affectation> activeAffectations = affectationRepository.findActiveByCollaborateurId(requestedCollaborateurId);
        List<Conge> conges = congeRepository.findByCollaborateurIdOrderByDateDebutAsc(requestedCollaborateurId);
        String normalizedAuditEmail = normalizedEmail.trim().toLowerCase(FRENCH);
        List<Tache> jalons = tacheRepository.findUpcomingByCollaborateurId(requestedCollaborateurId, LocalDate.now());
        System.out.println("[DEBUG] normalizedEmail=" + normalizedAuditEmail);
        List<AuditLog> auditLogs = auditLogRepository.findRecentForUserOrTarget(normalizedAuditEmail);
        System.out.println("[CollaborateurDashboardService] auditLogs.size = " + auditLogs.size());
        List<AuditLog> recentAuditLogs = auditLogs == null ? List.of() : auditLogs;

        long projetsActifs = activeAffectations.stream()
            .map(affectation -> affectation.getProjet() != null ? affectation.getProjet().getId() : null)
            .filter(Objects::nonNull)
            .distinct()
            .count();

        CollaborateurDashboardDto.Disponibilite disponibilite = buildDisponibilite(connectedCollaborateur, conges);
        long competencesCount = collaborateurRepository.countCompetencesByCollaborateurId(connectedCollaborateur.getId());
        int chargeMoyenne = computeAverageLoad(activeAffectations);
        List<JournalRh> journalEntries = journalRhRepository.findTop5ByUtilisateurEmail(normalizedEmail);

        Map<Long, Integer> chargeByProjetId = activeAffectations.stream()
            .filter(affectation -> affectation.getProjet() != null && affectation.getProjet().getId() != null)
            .collect(Collectors.toMap(
                affectation -> affectation.getProjet().getId(),
                affectation -> normalizeCharge(affectation.getScore()),
                Integer::max
            ));

        List<CollaborateurDashboardDto.Jalon> prochainsJalons = jalons.stream()
            .sorted(Comparator.comparing(Tache::getDateEcheance))
            .limit(6)
            .map(tache -> {
                Long projetId = tache.getProjet() != null ? tache.getProjet().getId() : null;
                String projetNom = tache.getProjet() != null ? safeText(tache.getProjet().getNom(), "Projet non precise") : "Projet non precise";
                int charge = projetId != null ? chargeByProjetId.getOrDefault(projetId, chargeMoyenne) : chargeMoyenne;

                return new CollaborateurDashboardDto.Jalon(
                    projetNom,
                    safeText(tache.getTitre(), "Jalon sans titre"),
                    formatDate(tache.getDateEcheance()),
                    safeText(tache.getStatut(), "A_FAIRE"),
                    charge
                );
            })
            .toList();

        List<String> vigilanceEntries = buildVigilanceEntries(activeAffectations, disponibilite.etat());

        CollaborateurDashboardDto.PointsVigilance pointsVigilance = new CollaborateurDashboardDto.PointsVigilance(
            activeAffectations.size(),
            vigilanceEntries
        );

        List<CollaborateurDashboardDto.Activite> activites = buildActivites(
            recentAuditLogs,
            activeAffectations,
            connectedCollaborateur,
            disponibilite.etat()
        );

        List<CollaborateurDashboardDto.JournalEntry> vigilanceJournal = journalEntries.stream()
            .map(entry -> new CollaborateurDashboardDto.JournalEntry(
                safeText(entry.getAction(), "Action"),
                formatDateTime(entry.getDate()),
                safeText(entry.getDetails(), "")
            ))
            .toList();

        return new CollaborateurDashboardDto.Response(
            connectedCollaborateur.getId(),
            buildFullName(connectedCollaborateur),
            projetsActifs,
            disponibilite,
            competencesCount,
            chargeMoyenne,
            prochainsJalons,
            pointsVigilance,
            vigilanceJournal,
            activites
        );
    }

    private CollaborateurDashboardDto.Disponibilite buildDisponibilite(Collaborateur collaborateur, List<Conge> conges) {
        LocalDate today = LocalDate.now();

        Conge congeActif = conges.stream()
            .filter(conge -> !conge.getDateDebut().isAfter(today) && !conge.getDateFin().isBefore(today))
            .findFirst()
            .orElse(null);

        if (congeActif != null) {
            String impact = safeText(congeActif.getImpactDisponibilite(), "INDISPONIBLE").trim().toUpperCase(FRENCH);
            boolean partielle = "PARTIELLE".equals(impact);
            String etat = partielle ? "Partielle" : "Indisponible";
            String message = partielle
                ? "Disponibilite reduite du " + formatDate(congeActif.getDateDebut()) + " au " + formatDate(congeActif.getDateFin())
                : "Indisponible du " + formatDate(congeActif.getDateDebut()) + " au " + formatDate(congeActif.getDateFin());

            return new CollaborateurDashboardDto.Disponibilite(
                etat,
                message,
                formatDate(congeActif.getDateDebut()),
                formatDate(congeActif.getDateFin())
            );
        }

        if (collaborateur.isDisponible()) {
            return new CollaborateurDashboardDto.Disponibilite(
                "Disponible",
                "Disponible pour les missions en cours.",
                null,
                null
            );
        }

        return new CollaborateurDashboardDto.Disponibilite(
            "Indisponible",
            "Disponibilite limitee, verifier le planning.",
            null,
            null
        );
    }

    private int computeAverageLoad(List<Affectation> activeAffectations) {
        if (activeAffectations.isEmpty()) {
            return 0;
        }

        double average = activeAffectations.stream()
            .mapToDouble(Affectation::getScore)
            .average()
            .orElse(0d);

        return normalizeCharge(average);
    }

    private int normalizeCharge(double score) {
        if (Double.isNaN(score) || Double.isInfinite(score)) {
            return 0;
        }
        return (int) Math.max(0, Math.min(100, Math.round(score)));
    }

    private List<String> buildVigilanceEntries(List<Affectation> activeAffectations, String disponibiliteEtat) {
        List<String> entries = new ArrayList<>();

        long highLoadCount = activeAffectations.stream()
            .filter(affectation -> normalizeCharge(affectation.getScore()) >= 80)
            .count();

        if (highLoadCount > 0) {
            entries.add(highLoadCount + " mission(s) avec une charge elevee (>= 80%).");
        }

        if (!"Disponible".equalsIgnoreCase(safeText(disponibiliteEtat, ""))) {
            entries.add("Disponibilite actuelle : " + disponibiliteEtat + ".");
        }

        if (entries.isEmpty()) {
            entries.add("Aucun point de vigilance critique detecte.");
        }

        return entries.stream().limit(3).toList();
    }

    private List<CollaborateurDashboardDto.Activite> buildActivites(
        List<AuditLog> auditLogs,
        List<Affectation> activeAffectations,
        Collaborateur collaborateur,
        String disponibiliteEtat
    ) {
        List<CollaborateurDashboardDto.Activite> activities = new ArrayList<>();

        auditLogs.stream()
            .filter(log -> log.getDate() != null)
            .sorted(Comparator.comparing(AuditLog::getDate).reversed())
            .limit(4)
            .forEach(log -> activities.add(new CollaborateurDashboardDto.Activite(
                initialsFromAction(log.getAction()),
                safeText(log.getDescription(), safeText(log.getAction(), "Action systeme")),
                relativeTime(log.getDate()),
                mapCategory(log.getAction()),
                formatDateTime(log.getDate())
            )));

        if (activities.isEmpty()) {
            activeAffectations.stream()
                .sorted(Comparator.comparing(Affectation::getDateAffectation).reversed())
                .limit(3)
                .forEach(affectation -> activities.add(new CollaborateurDashboardDto.Activite(
                    "PR",
                    "Affectation active : " + safeText(
                        affectation.getProjet() != null ? affectation.getProjet().getNom() : null,
                        "Projet non precise"
                    ),
                    affectation.getDateAffectation() != null ? relativeTime(affectation.getDateAffectation()) : "recemment",
                    "projet",
                    affectation.getDateAffectation() != null ? formatDateTime(affectation.getDateAffectation()) : null
                )));
        }

        if (activities.isEmpty()) {
            activities.add(new CollaborateurDashboardDto.Activite(
                initialsFromName(buildFullName(collaborateur)),
                "Disponibilite actuelle : " + disponibiliteEtat,
                "planning courant",
                "collab",
                formatDateTime(LocalDateTime.now())
            ));
        }

        return activities;
    }

    private String mapCategory(String action) {
        String normalized = safeText(action, "").trim().toUpperCase(FRENCH);

        if (normalized.contains("PROJET") || normalized.contains("AFFECTATION")) {
            return "projet";
        }

        if (normalized.contains("LOGIN") || normalized.contains("PROFILE") || normalized.contains("PROFIL")) {
            return "collab";
        }

        return "admin";
    }

    private String initialsFromAction(String action) {
        String normalized = safeText(action, "").trim();
        if (normalized.isBlank()) {
            return "AC";
        }

        String[] parts = normalized.split("[_\\s-]+");
        StringBuilder builder = new StringBuilder();
        for (String part : parts) {
            if (!part.isBlank()) {
                builder.append(Character.toUpperCase(part.charAt(0)));
            }
            if (builder.length() >= 2) {
                break;
            }
        }
        return builder.length() == 0 ? "AC" : builder.toString();
    }

    private String initialsFromName(String fullName) {
        String sanitized = safeText(fullName, "").trim();
        if (sanitized.isBlank()) {
            return "CD";
        }

        String[] parts = sanitized.split("\\s+");
        StringBuilder builder = new StringBuilder();
        for (String part : parts) {
            if (!part.isBlank()) {
                builder.append(Character.toUpperCase(part.charAt(0)));
            }
            if (builder.length() >= 2) {
                break;
            }
        }

        return builder.toString();
    }

    private String relativeTime(LocalDateTime dateTime) {
        long minutes = Math.max(0, ChronoUnit.MINUTES.between(dateTime, LocalDateTime.now()));

        if (minutes < 1) {
            return "a l'instant";
        }

        if (minutes < 60) {
            return "il y a " + minutes + " min";
        }

        long hours = minutes / 60;
        if (hours < 24) {
            return "il y a " + hours + " h";
        }

        long days = hours / 24;
        return "il y a " + days + " j";
    }

    private String buildFullName(Collaborateur collaborateur) {
        return (safeText(collaborateur.getPrenom(), "") + " " + safeText(collaborateur.getNom(), "")).trim();
    }

    private String formatDate(LocalDate date) {
        return date == null ? null : DATE_FORMAT.format(date);
    }

    private String formatDateTime(LocalDateTime dateTime) {
        return dateTime == null ? null : DATE_TIME_FORMAT.format(dateTime);
    }

    private String safeText(String value, String fallback) {
        if (value == null || value.isBlank()) {
            return fallback;
        }
        return value.trim();
    }

    private String normalizeEmail(String email) {
        return email == null ? "" : email.trim().toLowerCase(FRENCH);
    }

    private String getAuthenticatedEmailFromContext() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null || authentication.getName() == null) {
            return "";
        }
        return authentication.getName();
    }
}