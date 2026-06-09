package com.smartassign.pfe.service;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.stream.Collectors;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.smartassign.pfe.dto.AffectationCreateRequest;
import com.smartassign.pfe.dto.AffectationResponse;
import com.smartassign.pfe.dto.CollaborateurAffectationDto;
import com.smartassign.pfe.dto.CollaborateurResponse;
import com.smartassign.pfe.dto.ProjetResponse;
import com.smartassign.pfe.entity.Affectation;
import com.smartassign.pfe.entity.Collaborateur;
import com.smartassign.pfe.entity.Competence;
import com.smartassign.pfe.entity.Projet;
import com.smartassign.pfe.entity.Settings;
import com.smartassign.pfe.exception.BusinessException;
import com.smartassign.pfe.exception.ResourceNotFoundException;
import com.smartassign.pfe.model.Notification;
import com.smartassign.pfe.repository.AffectationRepository;
import com.smartassign.pfe.repository.CollaborateurRepository;
import com.smartassign.pfe.repository.ProjetRepository;

import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

@Service
@RequiredArgsConstructor
@Transactional
public class AffectationServiceImpl implements AffectationService {

    private static final Logger LOGGER = LoggerFactory.getLogger(AffectationServiceImpl.class);
    private static final Set<String> CANDIDATE_ROLES = Set.of("COLLAB");
    private static final String EXCELLENT_POTENTIEL = "Excellent";
    private static final String BON_POTENTIEL = "Bon";
    private static final String MOYEN_POTENTIEL = "Moyen";
    private static final String FAIBLE_POTENTIEL = "Faible";

    private final AffectationRepository   affectationRepository;
    private final CollaborateurRepository collaborateurRepository;
    private final ProjetRepository        projetRepository;
    private final CollaborateurService    collaborateurService;
    private final ProjetService           projetService;
    private final NotificationService     notificationService;
    private final SettingsService         settingsService;

    // ────────────────────────────────────────────────────
    // ⭐ ALGORITHME D'AFFECTATION INTELLIGENTE
    // ────────────────────────────────────────────────────
    public List<AffectationResponse> lancerAffectation(Long projetId) {

        // 0. Lire les paramètres systèmes (seuil + max profils)
        Settings cfg = settingsService.getOrCreate();
        int seuilMin = cfg.getSeuilCompatibilite() != null ? cfg.getSeuilCompatibilite() : 0;
        int maxProfils = cfg.getMaxProfilsRecommandes() != null ? cfg.getMaxProfilsRecommandes() : Integer.MAX_VALUE;
        if (maxProfils <= 0) maxProfils = Integer.MAX_VALUE;

        // 1. Charger le projet
        Projet projet = projetRepository.findById(projetId)
            .orElseThrow(() -> new ResourceNotFoundException("Projet introuvable : " + projetId));

        // 2. Compétences requises par le projet
        Set<Long> requises = projet.getCompetencesRequises()
                .stream().map(Competence::getId).collect(Collectors.toSet());

        // 3. Tous les collaborateurs disponibles avec un rôle réellement collaborateur
        List<Collaborateur> disponibles = collaborateurRepository.findAvailableCollaborateurCandidates().stream()
            .filter(this::isCollaborateurCandidate)
            .toList();

        // 4. Calculer score pour chaque collaborateur, filtrer par seuil, trier desc, limiter
        List<Collaborateur> retenus = new ArrayList<>();
        List<Double> scores = new ArrayList<>();
        record Scored(Collaborateur c, double s) {}
        List<Scored> classement = new ArrayList<>();
        List<Scored> classementGlobal = new ArrayList<>();
        for (Collaborateur collab : disponibles) {
            double score = calculerScore(collab, requises);
            if (score > 0) {
                classementGlobal.add(new Scored(collab, score));
            }
            if (score >= seuilMin && score > 0) {
                classement.add(new Scored(collab, score));
            }
        }

        // Fallback de robustesse : si le seuil configuré écarte tous les profils,
        // proposer les meilleurs profils disponibles selon le score calculé.
        // Cela évite un "Analyse terminée" vide côté interface.
        if (classement.isEmpty() && !classementGlobal.isEmpty()) {
            LOGGER.warn("[AFFECTATION] Aucun profil ne passe le seuil={} pour projet={}. Fallback sans seuil active.", seuilMin, projetId);
            classement = new ArrayList<>(classementGlobal);
        }

        classement.sort(Comparator.comparingDouble(Scored::s).reversed());
        if (classement.size() > maxProfils) {
            classement = new ArrayList<>(classement.subList(0, maxProfils));
        }
        for (Scored sc : classement) {
            retenus.add(sc.c);
            scores.add(sc.s);
        }

        LOGGER.info("[AFFECTATION] projet={} candidats={} retenus={} (seuil>={}, max={})",
                projetId, disponibles.size(), retenus.size(), seuilMin,
                maxProfils == Integer.MAX_VALUE ? "illimite" : maxProfils);

        // 5. Persister les affectations retenues
        List<Affectation> resultats = new ArrayList<>();
        for (int i = 0; i < retenus.size(); i++) {
            Collaborateur collab = retenus.get(i);
            double score = scores.get(i);

            affectationRepository.findByProjetId(projetId).stream()
                    .filter(a -> a.getCollaborateur().getId().equals(collab.getId()))
                    .findFirst()
                    .ifPresent(affectationRepository::delete);

            Affectation affectation = new Affectation(projet, collab, score);
            ensureDefaultStatus(affectation);
            affectation.setPotentiel(resolvePotentiel(affectation));
            resultats.add(affectationRepository.save(affectation));

            notificationService.notifierAffectation(
                collab.getPrenom() + " " + collab.getNom(),
                projet.getNom(),
                score
            );
        }

        notificationService.envoyerNotification(Notification.creer(
            "AFFECTATION",
            "Analyse terminée",
            resultats.size() + " collaborateur(s) trouvé(s) pour " + projet.getNom(),
            "INFO"
        ));

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

    private boolean isCollaborateurCandidate(Collaborateur collaborateur) {
        if (collaborateur == null) {
            return false;
        }

        String normalizedRole = collaborateur.getRole() == null
                ? ""
                : collaborateur.getRole().trim().toUpperCase(Locale.ROOT);
        return CANDIDATE_ROLES.contains(normalizedRole);
    }

    // ────────────────────────────────────────────────────
    // 📋 AUTRES MÉTHODES
    // ────────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public List<AffectationResponse> getAll() {
        return affectationRepository.findAllOrderByDateDesc()
                .stream()
                .filter(a -> isCollaborateurCandidate(a.getCollaborateur()))
                .map(this::toResponse).collect(Collectors.toList());
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
        ensureDefaultStatus(aff);
        aff.setPotentiel(resolvePotentiel(aff));
        Affectation saved = affectationRepository.save(aff);

        syncCollaborateurDisponibilite(collab);

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
                .stream()
                .filter(a -> isCollaborateurCandidate(a.getCollaborateur()))
                .map(this::toResponse).collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public List<AffectationResponse> getByCollaborateur(Long collaborateurId) {
        return affectationRepository.findByCollaborateurId(collaborateurId)
                .stream().map(this::toResponse).collect(Collectors.toList());
    }

        @Transactional(readOnly = true)
        public List<CollaborateurAffectationDto> getResumeByCollaborateur(Long collaborateurId) {
        return affectationRepository.findCollaborateurAffectationRows(collaborateurId)
            .stream()
            .map(row -> CollaborateurAffectationDto.builder()
                .id(row.getId())
                .projet(row.getProjet())
                .score(row.getScore() == null ? 0.0 : row.getScore())
                .dateAffectation(row.getDateAffectation())
                .statut(row.getStatut())
                .managerNom(row.getManagerNom())
                .build())
            .toList();
        }

    @Transactional(readOnly = true)
    public List<AffectationResponse> getHistoriqueByCollaborateur(Long collaborateurId) {
        return affectationRepository.findByCollaborateurId(collaborateurId)
                .stream()
                .filter(a -> {
                    String statut = (a.getProjet() != null && a.getProjet().getStatut() != null)
                            ? a.getProjet().getStatut().toUpperCase().trim()
                            : "";
                    return "TERMINE".equals(statut) || "ANNULE".equals(statut) || "SUSPENDU".equals(statut);
                })
                .map(this::toResponse)
                .collect(Collectors.toList());
    }

    public void delete(Long id) {
        Affectation affectation = affectationRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Affectation introuvable : " + id));
        Collaborateur collaborateur = affectation.getCollaborateur();
        affectationRepository.deleteById(id);
        syncCollaborateurDisponibilite(collaborateur);
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
        Collaborateur ancienCollaborateur = affectation.getCollaborateur();
        Collaborateur collaborateur = collaborateurRepository.findById(collaborateurId)
                .orElseThrow(() -> new ResourceNotFoundException("Collaborateur introuvable : " + collaborateurId));

        if (!isCollaborateurCandidate(collaborateur)) {
            throw new BusinessException("Le collaborateur sélectionné doit avoir un rôle COLLAB/COLLABORATEUR.");
        }

        if (ancienCollaborateur != null && ancienCollaborateur.getId() != null
                && ancienCollaborateur.getId().equals(collaborateur.getId())) {
            return toResponse(affectation);
        }

        if (!collaborateur.isDisponible()) {
            throw new BusinessException("Le collaborateur sélectionné est déjà occupé.");
        }

        affectation.setCollaborateur(collaborateur);
        ensureDefaultStatus(affectation);
        affectation.setPotentiel(resolvePotentiel(affectation));
        Affectation saved = affectationRepository.save(affectation);

        // Ancien collaborateur: redevient disponible s'il n'a plus d'autres affectations actives.
        // Nouveau collaborateur: devient occupé car il reçoit cette affectation.
        syncCollaborateurDisponibilite(ancienCollaborateur);
        syncCollaborateurDisponibilite(collaborateur);
        return toResponse(saved);
    }

    private String resolvePotentiel(Affectation affectation) {
        if (affectation == null) {
            return FAIBLE_POTENTIEL;
        }
        return scoreToPotentiel(affectation.getScore());
    }

    private String scoreToPotentiel(double score) {
        if (score >= 75) {
            return EXCELLENT_POTENTIEL;
        }
        if (score >= 50) {
            return BON_POTENTIEL;
        }
        if (score >= 25) {
            return MOYEN_POTENTIEL;
        }
        return FAIBLE_POTENTIEL;
    }

    private void ensureDefaultStatus(Affectation affectation) {
        if (affectation == null) {
            return;
        }

        if (affectation.getStatut() == null || affectation.getStatut().isBlank()) {
            affectation.setStatut("EN_ATTENTE");
        }
    }

    private void syncCollaborateurDisponibilite(Collaborateur collaborateur) {
        if (collaborateur == null || collaborateur.getId() == null) {
            return;
        }

        // Compte TOUTES les affectations restantes sur des projets non terminés/annulés.
        // Ceci couvre en_attente + en_cours, pas seulement en_cours.
        boolean hasAffectations = affectationRepository.countAffectationsNonTerminees(collaborateur.getId()) > 0;
        boolean shouldBeDisponible = !hasAffectations;
        if (collaborateur.isDisponible() != shouldBeDisponible) {
            collaborateur.setDisponible(shouldBeDisponible);
            collaborateurRepository.save(collaborateur);
        }
    }

    // ── Mapper ───────────────────────────────────────────
    private AffectationResponse toResponse(Affectation a) {
        CollaborateurResponse collabDto = collaborateurService.toResponse(a.getCollaborateur());
        ProjetResponse        projetDto = projetService.toResponse(a.getProjet(), List.of(a));

        return AffectationResponse.builder()
                .id(a.getId())
                .projet(projetDto)
                .collaborateur(collabDto)
                .score(a.getScore())
            .potentiel(a.getPotentiel())
                .dateAffectation(a.getDateAffectation())
                .build();
    }
}