package com.smartassign.pfe.controller;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.Objects;
import java.util.Optional;
import java.util.stream.Collectors;

import org.springframework.security.core.Authentication;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.smartassign.pfe.entity.Affectation;
import com.smartassign.pfe.entity.Collaborateur;
import com.smartassign.pfe.entity.Projet;
import com.smartassign.pfe.model.Notification;
import com.smartassign.pfe.repository.AffectationRepository;
import com.smartassign.pfe.repository.CollaborateurRepository;

@RestController
@RequestMapping("/api/collaborateur/notifications")
public class CollaborateurNotificationController {

    private final CollaborateurRepository collaborateurRepository;
    private final AffectationRepository affectationRepository;

    public CollaborateurNotificationController(
            CollaborateurRepository collaborateurRepository,
            AffectationRepository affectationRepository) {
        this.collaborateurRepository = collaborateurRepository;
        this.affectationRepository = affectationRepository;
    }

    @GetMapping
    @Transactional(readOnly = true)
    public List<Notification> list(Authentication authentication) {
        if (authentication == null || authentication.getName() == null) {
            return List.of();
        }

        String email = authentication.getName().trim();
        if (email.isEmpty()) {
            return List.of();
        }

        Optional<Collaborateur> collab = collaborateurRepository.findByEmailIgnoreCase(email);
        if (collab.isEmpty() || collab.get().getId() == null) {
            return List.of();
        }

        Long collaborateurId = collab.get().getId();

        List<Affectation> affectations = affectationRepository.findByCollaborateurId(collaborateurId);
        if (affectations == null || affectations.isEmpty()) {
            return List.of();
        }

        return affectations.stream()
            .filter(Objects::nonNull)
            .filter(affectation -> affectation.getProjet() != null)
                .sorted(Comparator.comparing(
                        Affectation::getDateAffectation,
                        Comparator.nullsLast(Comparator.reverseOrder())))
                .limit(100)
                .map(this::toNotification)
                .collect(Collectors.toList());
    }

    private Notification toNotification(Affectation affectation) {
        Projet projet = affectation.getProjet();
        String projetNom = projet.getNom() == null ? "Projet" : projet.getNom();
        int score = (int) Math.round(affectation.getScore());

        return new Notification(
                "AFFECTATION",
                "Affectation mise a jour - " + projetNom,
                "Score de compatibilite : " + score + "%",
                niveauForProjet(projet),
                affectation.getDateAffectation() != null ? affectation.getDateAffectation() : LocalDateTime.now());
    }

    private String niveauForProjet(Projet projet) {
        String statut = projet.getStatut() == null ? "" : projet.getStatut().toLowerCase(Locale.ROOT);
        if ("annule".equals(statut) || "rejete".equals(statut)) {
            return "DANGER";
        }
        if ("en_attente".equals(statut)) {
            return "WARNING";
        }

        LocalDate dateFin = projet.getDateFin();
        if (dateFin != null && dateFin.isBefore(LocalDate.now())) {
            return "WARNING";
        }

        return "INFO";
    }
}
