package com.smartassign.pfe.service;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.smartassign.pfe.entity.AdminNotification;
import com.smartassign.pfe.entity.Settings;
import com.smartassign.pfe.repository.AdminNotificationRepository;
import com.smartassign.pfe.repository.AffectationRepository;
import com.smartassign.pfe.repository.CollaborateurRepository;
import com.smartassign.pfe.repository.SettingsRepository;

import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
@Transactional
public class NotificationGeneratorService {

    private final AdminNotificationRepository notificationRepository;
    private final CollaborateurRepository collaborateurRepository;
    private final AffectationRepository affectationRepository;
    private final SettingsRepository settingsRepository;

    @Value("${app.notifications.scheduler.enabled:false}")
    private boolean schedulerEnabled;

    @Scheduled(cron = "${app.notifications.scheduler.cron:0 0 8 * * *}")
    public void scheduledGenerateSystemNotifications() {
        if (!schedulerEnabled) {
            return;
        }

        generateSystemNotifications();
    }

    public void generateSystemNotifications() {
        notificationRepository.deleteResolvedProjectWithoutManagerNotifications();
        verifierTauxAffectation();

        for (AdminNotificationRepository.ProjectWithoutManagerRow project : notificationRepository.findProjectsWithoutManager()) {
            insertIfNotExists(
                "CRITIQUE",
                "Projet actif sans manager responsable",
                "Le projet " + safe(project.getNom()) + " n'a aucun manager",
                project.getId()
            );
        }

        for (AdminNotificationRepository.ProjectLateRow project : notificationRepository.findProjectsLate()) {
            insertIfNotExists(
                "CRITIQUE",
                "Projet dépasse sa date de fin",
                "Le projet " + safe(project.getNom()) + " est en retard",
                project.getId()
            );
        }

        LocalDate today = LocalDate.now();
        for (AdminNotificationRepository.ProjectExpiringRow project : notificationRepository.findProjectsExpiringSoon()) {
            if (project.getDateFin() == null) {
                continue;
            }

            long days = ChronoUnit.DAYS.between(today, project.getDateFin());
            if (days < 0 || days > 7) {
                continue;
            }

            insertIfNotExists(
                "VIGILANCE",
                "Projet " + safe(project.getNom()) + " expire dans " + days + " jours",
                "Aucune affectation definitive confirmee",
                project.getId()
            );
        }

        for (AdminNotificationRepository.OverloadedCollaboratorRow collaborator : notificationRepository.findOverloadedCollaborators()) {
            String fullName = (safe(collaborator.getPrenom()) + " " + safe(collaborator.getNom())).trim();
            int capacity = collaborator.getNbProjets() == null ? 0 : collaborator.getNbProjets().intValue() * 100;

            insertIfNotExists(
                "CRITIQUE",
                "Collaborateur surcharge (>100%) — " + fullName,
                fullName + " est a " + capacity + "% de capacite",
                null
            );
        }
    }

    public void verifierTauxAffectation() {
        long totalCollabs = collaborateurRepository.countByRoleIgnoreCase("COLLAB");
        if (totalCollabs == 0) {
            return;
        }

        long collabsAffectes = affectationRepository.countDistinctCollaborateursActifs();
        double taux = (collabsAffectes * 100.0) / totalCollabs;
        double seuil = settingsRepository.findById(1L)
            .map(Settings::getSeuilCompatibilite)
            .map(Integer::doubleValue)
            .orElse(75.0);

        if (taux >= seuil) {
            return;
        }

        String titre = "Taux d'affectation faible";
        if (notificationRepository.existsByTypeAndTitre("VIGILANCE", titre)) {
            return;
        }

        String description = "Le taux est de "
            + Math.round(taux)
            + "%, sous le seuil de "
            + Math.round(seuil)
            + "%.";

        insertIfNotExists("VIGILANCE", titre, description, null);
    }

    public void createInfoNotification(String titre, String description, Long projetId) {
        AdminNotification notification = AdminNotification.builder()
            .type("INFO")
            .titre(safe(titre))
            .description(safe(description))
            .isRead(false)
            .createdAt(LocalDateTime.now())
            .updatedAt(LocalDateTime.now())
            .projetId(projetId)
            .build();

        notificationRepository.save(notification);
    }

    public void createUserCreatedNotification(String email) {
        String emailSafe = safe(email);
        createInfoNotification(
            "Nouvel utilisateur créé",
            "Nouvel utilisateur créé : " + emailSafe,
            null
        );
    }

    public void createUserUpdatedNotification(String email) {
        String emailSafe = safe(email);
        createInfoNotification(
            "Utilisateur modifié",
            "Utilisateur modifié : " + emailSafe,
            null
        );
    }

    public void createUserDeletedNotification(String email) {
        String emailSafe = safe(email);
        createInfoNotification(
            "Utilisateur supprimé",
            "Utilisateur supprimé : " + emailSafe,
            null
        );
    }

    public void createUserEmailVerifiedNotification(String email) {
        String emailSafe = safe(email);
        createInfoNotification(
            "Email vérifié",
            "Adresse email vérifiée : " + emailSafe,
            null
        );
    }

    public void createProjectCreatedNotification(String projectName, Long projectId) {
        createInfoNotification(
            "Projet créé",
            "Projet créé : " + safe(projectName),
            projectId
        );
    }

    public void createProjectDeletedNotification(String projectName) {
        createInfoNotification(
            "Projet supprimé",
            "Projet supprimé : " + safe(projectName),
            null
        );
    }

    public void genererInfoCompteCree(String email) {
        createUserCreatedNotification(email);
    }

    private void insertIfNotExists(String type, String titre, String description, Long projetId) {
        if (notificationRepository.existsByTypeTitreDescription(type, titre, description)) {
            return;
        }

        AdminNotification notification = AdminNotification.builder()
            .type(type)
            .titre(titre)
            .description(description)
            .isRead(false)
            .createdAt(LocalDateTime.now())
            .updatedAt(LocalDateTime.now())
            .projetId(projetId)
            .build();

        notificationRepository.save(notification);
    }

    private String safe(String value) {
        return value == null ? "" : value.trim();
    }
}
