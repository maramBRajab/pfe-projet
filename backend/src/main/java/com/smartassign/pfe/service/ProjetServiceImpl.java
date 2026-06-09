package com.smartassign.pfe.service;

import java.time.LocalDate;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.stream.Collectors;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.smartassign.pfe.dto.CompetenceResponse;
import com.smartassign.pfe.dto.ProjetRequest;
import com.smartassign.pfe.dto.ProjetResponse;
import com.smartassign.pfe.entity.Affectation;
import com.smartassign.pfe.entity.Collaborateur;
import com.smartassign.pfe.entity.Competence;
import com.smartassign.pfe.entity.Projet;
import com.smartassign.pfe.entity.Tache;
import com.smartassign.pfe.entity.Utilisateur;
import com.smartassign.pfe.exception.BusinessException;
import com.smartassign.pfe.exception.ResourceNotFoundException;
import com.smartassign.pfe.repository.AffectationRepository;
import com.smartassign.pfe.repository.AdminNotificationRepository;
import com.smartassign.pfe.repository.CompetenceRepository;
import com.smartassign.pfe.repository.ProjetRepository;
import com.smartassign.pfe.repository.TacheRepository;
import com.smartassign.pfe.repository.UtilisateurRepository;

import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
@Transactional
public class ProjetServiceImpl implements ProjetService {

    private final ProjetRepository     projetRepository;
    private final CompetenceRepository competenceRepository;
    private final AffectationRepository affectationRepository;
    private final TacheRepository       tacheRepository;
    private final UtilisateurRepository utilisateurRepository;
    private final AdminNotificationRepository adminNotificationRepository;

    // ── Lister tous ─────────────────────────────────────
    @Transactional
    public List<ProjetResponse> getAll() {
        List<Projet> projets = projetRepository.findAll();
        LocalDate today = LocalDate.now();
        Map<Long, List<Affectation>> affectationsByProjet = affectationRepository.findAll().stream()
            .filter(affectation -> affectation.getProjet() != null && affectation.getProjet().getId() != null)
            .collect(Collectors.groupingBy(affectation -> affectation.getProjet().getId()));
        Map<Long, List<Tache>> tachesByProjet = tacheRepository.findAll().stream()
            .filter(tache -> tache.getProjet() != null && tache.getProjet().getId() != null)
            .collect(Collectors.groupingBy(tache -> tache.getProjet().getId()));

        // Mise à jour automatique du statut en_retard si dateFin dépassée et projet non terminé
        for (Projet projet : projets) {
            autoUpdateStatut(projet, today);
        }

        return projets.stream()
            .map(projet -> toResponse(
                projet,
                affectationsByProjet.getOrDefault(projet.getId(), List.of()),
                tachesByProjet.getOrDefault(projet.getId(), List.of())
            ))
            .collect(Collectors.toList());
    }

    // ── Trouver par ID ───────────────────────────────────
    @Transactional
    public ProjetResponse getById(Long id) {
        Projet projet = findProjetById(id);
        autoUpdateStatut(projet, LocalDate.now());
        return toResponse(projet, affectationRepository.findByProjetId(id), tacheRepository.findByProjetId(id));
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
            .managerId(request.getManagerId())
                .competencesRequises(resolveCompetences(request.getCompetenceIds()))
                .build();

        return toResponse(projetRepository.save(p), List.of(), List.of());
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
        p.setManagerId(request.getManagerId());
        p.setCompetencesRequises(resolveCompetences(request.getCompetenceIds()));

        return toResponse(projetRepository.save(p), affectationRepository.findByProjetId(id), tacheRepository.findByProjetId(id));
    }

    public ProjetResponse updateStatut(Long id, String statut) {
        Projet projet = findProjetById(id);

        projet.setStatut(normalizeStatut(statut));
        return toResponse(projetRepository.save(projet), affectationRepository.findByProjetId(id), tacheRepository.findByProjetId(id));
    }

    // ── Supprimer ────────────────────────────────────────
    public void delete(Long id) {
        Projet projet = findProjetById(id);
        affectationRepository.deleteAll(affectationRepository.findByProjetId(id));
        tacheRepository.deleteAll(tacheRepository.findByProjetId(id));
        projet.getCompetencesRequises().clear();
        adminNotificationRepository.detachProject(id);
        projetRepository.delete(projet);
    }

    // ── Par statut ───────────────────────────────────────
    @Transactional
    public List<ProjetResponse> getByStatut(String statut) {
        LocalDate today = LocalDate.now();
        return projetRepository.findByStatut(statut)
                .stream()
            .peek(projet -> autoUpdateStatut(projet, today))
            .map(projet -> toResponse(projet, affectationRepository.findByProjetId(projet.getId()), tacheRepository.findByProjetId(projet.getId())))
                .collect(Collectors.toList());
    }

    // ── Mapper entité → DTO ──────────────────────────────
    @Override
    public ProjetResponse toResponse(Projet projet, List<Affectation> affectations) {
        List<Tache> taches = tacheRepository.findByProjetId(projet.getId());
        return toResponse(projet, affectations, taches);
    }

    public ProjetResponse toResponse(Projet p, List<Affectation> affectations, List<Tache> taches) {
        Set<CompetenceResponse> competences = p.getCompetencesRequises().stream()
                .map(c -> new CompetenceResponse(c.getId(), c.getNom()))
                .collect(Collectors.toSet());

        String managerNom = resolveManagerNom(p, affectations);
        int nombreCollabs = (int) affectations.stream()
            .map(Affectation::getCollaborateur)
            .filter(Objects::nonNull)
            .map(Collaborateur::getId)
            .filter(Objects::nonNull)
            .distinct()
            .count();
        int progression = computeProgression(p, taches);

        return ProjetResponse.builder()
                .id(p.getId())
                .nom(p.getNom())
                .description(p.getDescription())
                .dateDebut(p.getDateDebut())
                .dateFin(p.getDateFin())
                .statut(p.getStatut())
            .managerId(p.getManagerId())
                .managerNom(managerNom == null || managerNom.isBlank() ? null : managerNom)
                .nombreCollabs(nombreCollabs)
                .progression(progression)
                .competencesRequises(competences)
                .build();
    }

    private int computeProgression(Projet projet, List<Tache> taches) {
        if (taches == null || taches.isEmpty()) {
            return 0;
        }

        long completed = taches.stream()
                .filter(Objects::nonNull)
                .map(Tache::getStatut)
                .map(this::safeText)
                .map(status -> status.toUpperCase(Locale.ROOT))
                .filter(status -> status.contains("TERMINE"))
                .count();

        return (int) Math.round((completed * 100.0) / taches.size());
    }

    private String resolveManagerNom(Projet projet, List<Affectation> affectations) {
        if (projet.getManagerId() != null) {
            Utilisateur manager = utilisateurRepository.findById(projet.getManagerId()).orElse(null);
            if (manager != null && isManagerRole(manager.getRole())) {
                String fullName = safeText(manager.getNom());
                return fullName.isBlank() ? null : fullName;
            }
        }

        Collaborateur managerFromAffectation = affectations.stream()
                .map(Affectation::getCollaborateur)
                .filter(Objects::nonNull)
                .filter(collaborateur -> isManagerRole(collaborateur.getRole()))
                .findFirst()
                .orElse(null);

        if (managerFromAffectation != null) {
            String fullName = (safeText(managerFromAffectation.getPrenom()) + " " + safeText(managerFromAffectation.getNom())).trim();
            if (!fullName.isBlank()) {
                return fullName;
            }
        }

        return null;
    }

    private boolean isManagerRole(String role) {
        String normalized = safeText(role).toUpperCase(Locale.ROOT);
        return normalized.contains("MANAGER") || normalized.contains("CHEF");
    }

    private String safeText(String value) {
        return value == null ? "" : value.trim();
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

    /**
     * Met à jour automatiquement le statut d'un projet (sans déclencher d'événement d'audit) :
     * - Si dateFin est dépassée et le projet n'est pas terminé → "en_retard"
     * La transaction courante sauvegarde le changement via dirty-checking JPA.
     */
    private void autoUpdateStatut(Projet projet, LocalDate today) {
        if (projet.getId() == null) return;
        String current = safeText(projet.getStatut()).toLowerCase(Locale.ROOT);
        if ("termine".equals(current)) return; // Jamais régresser un projet terminé

        boolean depasseEcheance = projet.getDateFin() != null && projet.getDateFin().isBefore(today);
        boolean dejaMarcheRetard = "en_retard".equals(current);

        if (depasseEcheance && !dejaMarcheRetard) {
            projet.setStatut("en_retard");
            projetRepository.save(projet);
        }
    }
}
