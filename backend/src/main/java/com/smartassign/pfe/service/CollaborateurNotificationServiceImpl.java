package com.smartassign.pfe.service;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Objects;
import java.util.Set;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import com.smartassign.pfe.dto.NotificationDto;
import com.smartassign.pfe.dto.NotificationSummaryDto;
import com.smartassign.pfe.entity.Collaborateur;
import com.smartassign.pfe.entity.Jalon;
import com.smartassign.pfe.entity.JournalRh;
import com.smartassign.pfe.entity.NotificationSupprimee;
import com.smartassign.pfe.entity.Tache;
import com.smartassign.pfe.repository.CollaborateurRepository;
import com.smartassign.pfe.repository.DisponibiliteUtilisateurRepository;
import com.smartassign.pfe.repository.JalonRepository;
import com.smartassign.pfe.repository.JournalRhRepository;
import com.smartassign.pfe.repository.NotificationSupprimeeRepository;
import com.smartassign.pfe.repository.TacheRepository;
import com.smartassign.pfe.repository.projection.DisponibiliteNotificationProjection;

import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class CollaborateurNotificationServiceImpl implements CollaborateurNotificationService {

    private static final Logger LOGGER = LoggerFactory.getLogger(CollaborateurNotificationServiceImpl.class);
    private static final Locale FRENCH = Locale.ROOT;

    private final CollaborateurRepository collaborateurRepository;
    private final TacheRepository tacheRepository;
    private final JalonRepository jalonRepository;
    private final JournalRhRepository journalRhRepository;
    private final DisponibiliteUtilisateurRepository disponibiliteUtilisateurRepository;
    private final NotificationSupprimeeRepository notificationSupprimeeRepository;

    @Override
    @Transactional(readOnly = true)
    public NotificationSummaryDto getNotifications(Long requestedCollaborateurId) {
        Collaborateur connectedCollaborateur = resolveAuthenticatedCollaborateur();
        Long effectiveCollaborateurId = connectedCollaborateur.getId();

        if (requestedCollaborateurId != null && !Objects.equals(requestedCollaborateurId, effectiveCollaborateurId)) {
            LOGGER.warn("[NOTIFICATIONS] Requested id {} differs from authenticated collaborateur id {}. Using authenticated id.",
                requestedCollaborateurId, effectiveCollaborateurId);
        }

        String email = normalizeEmail(connectedCollaborateur.getEmail());
        Set<String> suppressed = new HashSet<>(notificationSupprimeeRepository.findAllNotificationKeys());
        List<NotificationDto> notifications = new ArrayList<>();

        for (Tache tache : tacheRepository.findCriticalNotifications(effectiveCollaborateurId)) {
            String key = "TASK_CRITIQUE_" + tache.getId();
            if (suppressed.contains(key)) {
                continue;
            }
            notifications.add(new NotificationDto(
                tache.getId(),
                "CRITIQUE",
                safeText(tache.getTitre(), "Tache critique"),
                safeText(tache.getDescription(), "Une tache critique requiert votre attention."),
                toDateTime(tache.getDateEcheance()),
                key,
                false
            ));
        }

        for (Tache tache : tacheRepository.findVigilanceTaskNotifications(effectiveCollaborateurId)) {
            String key = "TASK_VIGILANCE_" + tache.getId();
            if (suppressed.contains(key)) {
                continue;
            }
            notifications.add(new NotificationDto(
                tache.getId(),
                "VIGILANCE",
                safeText(tache.getTitre(), "Tache a surveiller"),
                safeText(tache.getDescription(), "Echeance proche : suivez cette tache."),
                toDateTime(tache.getDateEcheance()),
                key,
                false
            ));
        }

        for (Jalon jalon : jalonRepository.findVigilanceJalons(effectiveCollaborateurId)) {
            String key = "JALON_VIGILANCE_" + jalon.getId();
            if (suppressed.contains(key)) {
                continue;
            }
            notifications.add(new NotificationDto(
                jalon.getId(),
                "VIGILANCE",
                safeText(jalon.getTitre(), "Jalon a surveiller"),
                safeText(jalon.getDescription(), "Un jalon approche dans les prochains jours."),
                jalon.getDate(),
                key,
                false
            ));
        }

        for (JournalRh journal : journalRhRepository.findTop10ByUtilisateurEmail(email)) {
            String key = "JOURNAL_INFO_" + journal.getId();
            if (suppressed.contains(key)) {
                continue;
            }
            notifications.add(new NotificationDto(
                journal.getId(),
                "INFO",
                safeText(journal.getAction(), "Information RH"),
                safeText(journal.getDetails(), "Mise a jour du journal RH."),
                journal.getDate(),
                key,
                false
            ));
        }

        for (DisponibiliteNotificationProjection disponibilite : disponibiliteUtilisateurRepository.findFutureDisponibilites(effectiveCollaborateurId)) {
            String key = "DISPO_INFO_" + disponibilite.getId();
            if (suppressed.contains(key)) {
                continue;
            }
            String description = disponibilite.getLibelle();
            if (description == null || description.isBlank()) {
                description = "Periode de disponibilite planifiee";
            }
            notifications.add(new NotificationDto(
                disponibilite.getId(),
                "INFO",
                "Disponibilite : " + safeText(disponibilite.getType(), "Mise a jour"),
                description,
                disponibilite.getDateDebut(),
                key,
                false
            ));
        }

        notifications.sort(Comparator.comparing(NotificationDto::date, Comparator.nullsLast(Comparator.reverseOrder())));

        int critiques = (int) notifications.stream().filter(notification -> "CRITIQUE".equals(notification.type())).count();
        int vigilances = (int) notifications.stream().filter(notification -> "VIGILANCE".equals(notification.type())).count();
        int informations = (int) notifications.stream().filter(notification -> "INFO".equals(notification.type())).count();

        return new NotificationSummaryDto(
            notifications.size(),
            informations,
            vigilances,
            critiques,
            notifications
        );
    }

    @Override
    @Transactional
    public void dismissNotification(Long requestedCollaborateurId, String notificationKey) {
        Collaborateur connectedCollaborateur = resolveAuthenticatedCollaborateur();
        if (requestedCollaborateurId != null && !Objects.equals(requestedCollaborateurId, connectedCollaborateur.getId())) {
            LOGGER.warn("[NOTIFICATIONS] Dismiss id {} differs from authenticated id {}. Using authenticated id.",
                requestedCollaborateurId, connectedCollaborateur.getId());
        }

        String key = notificationKey == null ? "" : notificationKey.trim();
        if (key.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Notification invalide.");
        }

        if (!notificationSupprimeeRepository.existsByNotificationKey(key)) {
            notificationSupprimeeRepository.save(new NotificationSupprimee(key));
        }
    }

    @Override
    @Transactional
    public void markAllRead(Long requestedCollaborateurId) {
        NotificationSummaryDto summary = getNotifications(requestedCollaborateurId);

        for (NotificationDto notification : summary.notifications()) {
            if (!notificationSupprimeeRepository.existsByNotificationKey(notification.notificationKey())) {
                notificationSupprimeeRepository.save(new NotificationSupprimee(notification.notificationKey()));
            }
        }
    }

    private Collaborateur resolveAuthenticatedCollaborateur() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null || authentication.getName() == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Session utilisateur invalide.");
        }

        String email = normalizeEmail(authentication.getName());
        if (email.isBlank()) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Session utilisateur invalide.");
        }

        return collaborateurRepository.findByEmailIgnoreCase(email)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Collaborateur introuvable."));
    }

    private String normalizeEmail(String email) {
        return email == null ? "" : email.trim().toLowerCase(FRENCH);
    }

    private String safeText(String value, String fallback) {
        if (value == null || value.isBlank()) {
            return fallback;
        }
        return value;
    }

    private LocalDateTime toDateTime(LocalDate date) {
        if (date == null) {
            return LocalDateTime.now();
        }
        return LocalDateTime.of(date, LocalTime.MIDNIGHT);
    }
}
