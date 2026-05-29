package com.smartassign.pfe.service;

import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.stream.Collectors;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.smartassign.pfe.dto.CompetenceResponse;
import com.smartassign.pfe.dto.ProjetRequest;
import com.smartassign.pfe.dto.ProjetResponse;
import com.smartassign.pfe.entity.Competence;
import com.smartassign.pfe.entity.Projet;
import com.smartassign.pfe.exception.BusinessException;
import com.smartassign.pfe.exception.ResourceNotFoundException;
import com.smartassign.pfe.repository.AffectationRepository;
import com.smartassign.pfe.repository.CompetenceRepository;
import com.smartassign.pfe.repository.ProjetRepository;
import com.smartassign.pfe.repository.TacheRepository;

import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
@Transactional
public class ProjetServiceImpl implements ProjetService {

    private final ProjetRepository     projetRepository;
    private final CompetenceRepository competenceRepository;
    private final AffectationRepository affectationRepository;
    private final TacheRepository       tacheRepository;

    // ── Lister tous ─────────────────────────────────────
    @Transactional(readOnly = true)
    public List<ProjetResponse> getAll() {
        return projetRepository.findAll()
                .stream().map(this::toResponse).collect(Collectors.toList());
    }

    // ── Trouver par ID ───────────────────────────────────
    @Transactional(readOnly = true)
    public ProjetResponse getById(Long id) {
        return toResponse(findProjetById(id));
    }

    // ── Créer ────────────────────────────────────────────
    public ProjetResponse create(ProjetRequest request) {
        validateDateRange(request);

        Projet p = Projet.builder()
                .nom(request.getNom())
                .description(request.getDescription())
                .dateDebut(request.getDateDebut())
                .dateFin(request.getDateFin())
                .statut(request.getStatut() != null ? request.getStatut() : "en_attente")
                .competencesRequises(resolveCompetences(request.getCompetenceIds()))
                .build();

        return toResponse(projetRepository.save(p));
    }

    // ── Modifier ─────────────────────────────────────────
    public ProjetResponse update(Long id, ProjetRequest request) {
        validateDateRange(request);

        Projet p = findProjetById(id);

        p.setNom(request.getNom());
        p.setDescription(request.getDescription());
        p.setDateDebut(request.getDateDebut());
        p.setDateFin(request.getDateFin());
        p.setStatut(request.getStatut());
        p.setCompetencesRequises(resolveCompetences(request.getCompetenceIds()));

        return toResponse(projetRepository.save(p));
    }

    public ProjetResponse updateStatut(Long id, String statut) {
        Projet projet = findProjetById(id);

        projet.setStatut(normalizeStatut(statut));
        return toResponse(projetRepository.save(projet));
    }

    // ── Supprimer ────────────────────────────────────────
    public void delete(Long id) {
        Projet projet = findProjetById(id);
        affectationRepository.deleteAll(affectationRepository.findByProjetId(id));
        tacheRepository.deleteAll(tacheRepository.findByProjetId(id));
        projetRepository.delete(projet);
    }

    // ── Par statut ───────────────────────────────────────
    @Transactional(readOnly = true)
    public List<ProjetResponse> getByStatut(String statut) {
        return projetRepository.findByStatut(statut)
                .stream().map(this::toResponse).collect(Collectors.toList());
    }

    // ── Mapper entité → DTO ──────────────────────────────
    public ProjetResponse toResponse(Projet p) {
        Set<CompetenceResponse> competences = p.getCompetencesRequises().stream()
                .map(c -> new CompetenceResponse(c.getId(), c.getNom()))
                .collect(Collectors.toSet());

        return ProjetResponse.builder()
                .id(p.getId())
                .nom(p.getNom())
                .description(p.getDescription())
                .dateDebut(p.getDateDebut())
                .dateFin(p.getDateFin())
                .statut(p.getStatut())
                .competencesRequises(competences)
                .build();
    }

    // ── Résoudre les IDs compétences ─────────────────────
    private Set<Competence> resolveCompetences(Set<Long> ids) {
        if (ids == null || ids.isEmpty()) return new HashSet<>();
        return ids.stream()
            .map(this::findCompetenceById)
                .collect(Collectors.toCollection(HashSet::new));
    }

        private Projet findProjetById(Long id) {
        return projetRepository.findById(id)
            .orElseThrow(() -> new ResourceNotFoundException("Projet introuvable : " + id));
        }

        private Competence findCompetenceById(Long id) {
        return competenceRepository.findById(id)
            .orElseThrow(() -> new ResourceNotFoundException("Compétence introuvable : " + id));
        }

    private void validateDateRange(ProjetRequest request) {
        if (request.getDateDebut() != null
                && request.getDateFin() != null
                && request.getDateFin().isBefore(request.getDateDebut())) {
            throw new BusinessException("La date de fin doit etre apres ou egale a la date de debut");
        }
    }

    private String normalizeStatut(String statut) {
        if (statut == null || statut.isBlank()) {
            throw new BusinessException("Le statut du projet est obligatoire");
        }

        String normalized = statut.trim().toLowerCase(Locale.ROOT);
        return switch (normalized) {
            case "en_attente", "en cours", "en_cours" -> "en_attente".equals(normalized) ? "en_attente" : "en_cours";
            case "termine", "terminé" -> "termine";
            case "en_pause" -> "en_pause";
            case "en_retard" -> "en_retard";
            default -> throw new BusinessException("Statut de projet invalide : " + statut);
        };
    }
}