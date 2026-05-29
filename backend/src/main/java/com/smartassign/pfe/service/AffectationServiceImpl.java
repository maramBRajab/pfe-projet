package com.smartassign.pfe.service;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.smartassign.pfe.dto.AffectationCreateRequest;
import com.smartassign.pfe.dto.AffectationResponse;
import com.smartassign.pfe.dto.CollaborateurResponse;
import com.smartassign.pfe.dto.ProjetResponse;
import com.smartassign.pfe.entity.Affectation;
import com.smartassign.pfe.entity.Collaborateur;
import com.smartassign.pfe.entity.Competence;
import com.smartassign.pfe.entity.Projet;
import com.smartassign.pfe.exception.ResourceNotFoundException;
import com.smartassign.pfe.model.Notification;
import com.smartassign.pfe.repository.AffectationRepository;
import com.smartassign.pfe.repository.CollaborateurRepository;
import com.smartassign.pfe.repository.ProjetRepository;

import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
@Transactional
public class AffectationServiceImpl implements AffectationService {

    private final AffectationRepository   affectationRepository;
    private final CollaborateurRepository collaborateurRepository;
    private final ProjetRepository        projetRepository;
    private final CollaborateurService    collaborateurService;
    private final ProjetService           projetService;
    private final NotificationService     notificationService;

    // ────────────────────────────────────────────────────
    // ⭐ ALGORITHME D'AFFECTATION INTELLIGENTE
    // ────────────────────────────────────────────────────
    public List<AffectationResponse> lancerAffectation(Long projetId) {

        // 1. Charger le projet
        Projet projet = projetRepository.findById(projetId)
            .orElseThrow(() -> new ResourceNotFoundException("Projet introuvable : " + projetId));

        // 2. Compétences requises par le projet
        Set<Long> requises = projet.getCompetencesRequises()
                .stream().map(Competence::getId).collect(Collectors.toSet());

        // 3. Tous les collaborateurs disponibles
        List<Collaborateur> disponibles = collaborateurRepository.findByDisponibleTrue();

        // 4. Calculer le score pour chaque collaborateur
        List<Affectation> resultats = new ArrayList<>();

        for (Collaborateur collab : disponibles) {
            double score = calculerScore(collab, requises);

            if (score > 0) {
                affectationRepository
                        .findByProjetId(projetId)
                        .stream()
                        .filter(a -> a.getCollaborateur().getId().equals(collab.getId()))
                        .findFirst()
                        .ifPresent(affectationRepository::delete);

                Affectation affectation = new Affectation(projet, collab, score);
                resultats.add(affectationRepository.save(affectation));

                // 🔔 Envoyer notification pour chaque affectation
                notificationService.notifierAffectation(
                    collab.getPrenom() + " " + collab.getNom(),
                    projet.getNom(),
                    score
                );
            }
        }

        // 🔔 Notification résumé final
        notificationService.envoyerNotification(Notification.creer(
            "AFFECTATION",
            "Analyse terminée",
            resultats.size() + " collaborateur(s) trouvé(s) pour " + projet.getNom(),
            "INFO"
        ));

        // 5. Trier par score décroissant et retourner
        return resultats.stream()
                .sorted(Comparator.comparingDouble(Affectation::getScore).reversed())
                .map(this::toResponse)
                .collect(Collectors.toList());
    }

    // ────────────────────────────────────────────────────
    // 🧮 CALCUL DU SCORE (0 → 100)
    // ────────────────────────────────────────────────────
    private double calculerScore(Collaborateur collab, Set<Long> requisIds) {

        if (requisIds.isEmpty()) {
            return Math.min(collab.getExperienceAnnees() * 5.0, 50.0);
        }

        Set<Long> collabCompIds = collab.getCompetences()
                .stream().map(Competence::getId).collect(Collectors.toSet());

        long matches = requisIds.stream()
                .filter(collabCompIds::contains).count();

        if (matches == 0) return 0.0;

        double scoreComp = ((double) matches / requisIds.size()) * 70.0;
        double scoreExp = Math.min(collab.getExperienceAnnees() / 15.0, 1.0) * 30.0;

        return Math.round((scoreComp + scoreExp) * 10.0) / 10.0;
    }

    // ────────────────────────────────────────────────────
    // 📋 AUTRES MÉTHODES
    // ────────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public List<AffectationResponse> getAll() {
        return affectationRepository.findAllOrderByDateDesc()
                .stream().map(this::toResponse).collect(Collectors.toList());
    }

    // ⭐ Création unitaire — appelée par le bouton "Affecter"
    public AffectationResponse create(AffectationCreateRequest request) {
        Projet projet = projetRepository.findById(request.getProjetId())
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Projet introuvable : " + request.getProjetId()));

        Collaborateur collab = collaborateurRepository.findById(request.getCollaborateurId())
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Collaborateur introuvable : " + request.getCollaborateurId()));

        // Eviter les doublons : si déjà affecté à ce projet, on retourne l'existant
        var existante = affectationRepository.findByProjetId(projet.getId()).stream()
                .filter(a -> a.getCollaborateur().getId().equals(collab.getId()))
                .findFirst();
        if (existante.isPresent()) {
            return toResponse(existante.get());
        }

        double score = request.getScore() != null ? request.getScore() : 0.0;
        Affectation aff = new Affectation(projet, collab, score);
        Affectation saved = affectationRepository.save(aff);

        // Mettre le collaborateur en indisponible
        if (collab.isDisponible()) {
            collab.setDisponible(false);
            collaborateurRepository.save(collab);
        }

        // Notification
        notificationService.notifierAffectation(
                collab.getPrenom() + " " + collab.getNom(),
                projet.getNom(),
                score
        );

        return toResponse(saved);
    }

    @Transactional(readOnly = true)
    public List<AffectationResponse> getByProjet(Long projetId) {
        return affectationRepository.findByProjetIdOrderByScoreDesc(projetId)
                .stream().map(this::toResponse).collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public List<AffectationResponse> getByCollaborateur(Long collaborateurId) {
        return affectationRepository.findByCollaborateurId(collaborateurId)
                .stream().map(this::toResponse).collect(Collectors.toList());
    }

    public void delete(Long id) {
        if (!affectationRepository.existsById(id)) {
            throw new ResourceNotFoundException("Affectation introuvable : " + id);
        }
        affectationRepository.deleteById(id);
    }

    @Transactional(readOnly = true)
    public AffectationResponse getById(Long id) {
        Affectation a = affectationRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Affectation introuvable : " + id));
        return toResponse(a);
    }

    public AffectationResponse update(Long id, Long collaborateurId) {
        Affectation affectation = affectationRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Affectation introuvable : " + id));
        Collaborateur collaborateur = collaborateurRepository.findById(collaborateurId)
                .orElseThrow(() -> new ResourceNotFoundException("Collaborateur introuvable : " + collaborateurId));
        affectation.setCollaborateur(collaborateur);
        return toResponse(affectationRepository.save(affectation));
    }

    // ── Mapper ───────────────────────────────────────────
    private AffectationResponse toResponse(Affectation a) {
        CollaborateurResponse collabDto = collaborateurService.toResponse(a.getCollaborateur());
        ProjetResponse        projetDto = projetService.toResponse(a.getProjet());

        return AffectationResponse.builder()
                .id(a.getId())
                .projet(projetDto)
                .collaborateur(collabDto)
                .score(a.getScore())
                .dateAffectation(a.getDateAffectation())
                .build();
    }
}