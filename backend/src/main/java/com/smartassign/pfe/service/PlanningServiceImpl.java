package com.smartassign.pfe.service;

import java.time.LocalDate;
import java.util.Comparator;
import java.util.List;
import java.util.stream.Collectors;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.smartassign.pfe.dto.AffectationResponse;
import com.smartassign.pfe.dto.CollaborateurPlanningResponse;
import com.smartassign.pfe.dto.CollaborateurResponse;
import com.smartassign.pfe.dto.PlanningLeaveResponse;
import com.smartassign.pfe.dto.PlanningLeaveRequest;
import com.smartassign.pfe.dto.PlanningTaskResponse;
import com.smartassign.pfe.dto.ProjetResponse;
import com.smartassign.pfe.dto.UtilisateurDisponibiliteResponse;
import com.smartassign.pfe.entity.Affectation;
import com.smartassign.pfe.entity.Collaborateur;
import com.smartassign.pfe.entity.Conge;
import com.smartassign.pfe.entity.DisponibiliteUtilisateur;
import com.smartassign.pfe.entity.Tache;
import com.smartassign.pfe.exception.ResourceNotFoundException;
import com.smartassign.pfe.exception.BusinessException;
import com.smartassign.pfe.repository.AffectationRepository;
import com.smartassign.pfe.repository.CollaborateurRepository;
import com.smartassign.pfe.repository.CongeRepository;
import com.smartassign.pfe.repository.DisponibiliteUtilisateurRepository;
import com.smartassign.pfe.repository.TacheRepository;

import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class PlanningServiceImpl implements PlanningService {

    private final CollaborateurRepository collaborateurRepository;
    private final AffectationRepository affectationRepository;
    private final TacheRepository tacheRepository;
    private final CongeRepository congeRepository;
    private final DisponibiliteUtilisateurRepository disponibiliteUtilisateurRepository;
    private final CollaborateurService collaborateurService;
    private final ProjetService projetService;

    public CollaborateurPlanningResponse getByCollaborateur(Long collaborateurId) {
        Collaborateur collaborateur = collaborateurRepository.findById(collaborateurId)
                                .orElseThrow(() -> new ResourceNotFoundException("Collaborateur introuvable : " + collaborateurId));

        List<AffectationResponse> affectations = affectationRepository.findByCollaborateurId(collaborateurId)
                .stream()
                .sorted(Comparator.comparing(Affectation::getDateAffectation).reversed())
                .map(this::toAffectationResponse)
                .collect(Collectors.toList());

        List<PlanningTaskResponse> taches = tacheRepository.findByCollaborateurIdOrderByDateEcheanceAsc(collaborateurId)
                .stream()
                .map(this::toTaskResponse)
                .collect(Collectors.toList());

        List<PlanningLeaveResponse> conges = congeRepository.findByCollaborateurIdOrderByDateDebutAsc(collaborateurId)
                .stream()
                .map(this::toLeaveResponse)
                .collect(Collectors.toList());

        return CollaborateurPlanningResponse.builder()
                .collaborateur(collaborateurService.toResponse(collaborateur))
                .disponibiliteEtat(resolveAvailabilityState(collaborateur, conges))
                .disponibiliteMessage(resolveAvailabilityMessage(collaborateur, conges))
                .affectations(affectations)
                .taches(taches)
                .conges(conges)
                .build();
    }

    public List<PlanningTaskResponse> getTasksByCollaborateur(Long collaborateurId, LocalDate dateDebut, LocalDate dateFin) {
        return tacheRepository.findByCollaborateurIdAndDateRange(collaborateurId, dateDebut, dateFin)
                .stream()
                .map(this::toTaskResponse)
                .collect(Collectors.toList());
    }

    public List<PlanningLeaveResponse> getCongesByCollaborateur(Long collaborateurId) {
        return congeRepository.findByCollaborateurIdOrderByDateDebutAsc(collaborateurId)
                .stream()
                .map(this::toLeaveResponse)
                .collect(Collectors.toList());
    }

    public UtilisateurDisponibiliteResponse getDisponibiliteByUtilisateur(Long userId) {
        DisponibiliteUtilisateur disponibilite = disponibiliteUtilisateurRepository.findByUserId(userId)
                .orElseGet(() -> DisponibiliteUtilisateur.builder().userId(userId).statut("INDISPONIBLE").build());

        return UtilisateurDisponibiliteResponse.builder()
                .userId(disponibilite.getUserId())
                .statut(disponibilite.getStatut())
                .build();
    }

    @Override
    @Transactional
    public PlanningTaskResponse updateTaskStatus(Long collaborateurId, Long taskId, String statut) {
        Tache tache = tacheRepository.findById(taskId)
                .orElseThrow(() -> new ResourceNotFoundException("Tache introuvable : " + taskId));

        if (tache.getCollaborateur() == null || !collaborateurId.equals(tache.getCollaborateur().getId())) {
            throw new BusinessException("Cette tache n'appartient pas au collaborateur demande");
        }

        tache.setStatut(normalizeTaskStatus(statut));
        return toTaskResponse(tacheRepository.save(tache));
    }

    @Override
    @Transactional
    public PlanningLeaveResponse createConge(Long collaborateurId, PlanningLeaveRequest request) {
        Collaborateur collaborateur = collaborateurRepository.findById(collaborateurId)
                .orElseThrow(() -> new ResourceNotFoundException("Collaborateur introuvable : " + collaborateurId));

        String impact = normalizeLeaveImpact(request.getImpactDisponibilite());
        Conge conge = Conge.builder()
                .libelle(request.getLibelle().trim())
                .type(request.getType().trim())
                .dateDebut(request.getDateDebut())
                .dateFin(request.getDateFin())
                .impactDisponibilite(impact)
                .collaborateur(collaborateur)
                .build();

        Conge saved = congeRepository.save(conge);
        syncAvailabilityIfCurrent(collaborateur, saved);
        return toLeaveResponse(saved);
    }

    private AffectationResponse toAffectationResponse(Affectation affectation) {
        CollaborateurResponse collaborateur = collaborateurService.toResponse(affectation.getCollaborateur());
                ProjetResponse projet = projetService.toResponse(affectation.getProjet(), List.of(affectation));

        return AffectationResponse.builder()
                .id(affectation.getId())
                .projet(projet)
                .collaborateur(collaborateur)
                .score(affectation.getScore())
                .potentiel(affectation.getPotentiel())
                .dateAffectation(affectation.getDateAffectation())
                .build();
    }

    private PlanningTaskResponse toTaskResponse(Tache tache) {
        return PlanningTaskResponse.builder()
                .id(tache.getId())
                .titre(tache.getTitre())
                .description(tache.getDescription())
                .dateEcheance(tache.getDateEcheance())
                .statut(tache.getStatut())
                .priorite(tache.getPriorite())
                .projetId(tache.getProjet() != null ? tache.getProjet().getId() : null)
                .projetNom(tache.getProjet() != null ? tache.getProjet().getNom() : null)
                .build();
    }

    private PlanningLeaveResponse toLeaveResponse(Conge conge) {
        return PlanningLeaveResponse.builder()
                .id(conge.getId())
                .libelle(conge.getLibelle())
                .type(conge.getType())
                .dateDebut(conge.getDateDebut())
                .dateFin(conge.getDateFin())
                .impactDisponibilite(conge.getImpactDisponibilite())
                .build();
    }

    private String normalizeTaskStatus(String statut) {
        String normalized = statut == null ? "" : statut.trim().toUpperCase();
        return switch (normalized) {
            case "EN_COURS", "EN COURS", "IN_PROGRESS" -> "EN_COURS";
            case "TERMINE", "TERMINEE", "TERMINÉ", "TERMINÉE", "DONE" -> "TERMINE";
            case "A_FAIRE", "A FAIRE", "TODO" -> "A_FAIRE";
            default -> throw new BusinessException("Statut de tache invalide : " + statut);
        };
    }

    private String normalizeLeaveImpact(String impact) {
        String normalized = impact == null ? "" : impact.trim().toUpperCase();
        return switch (normalized) {
            case "PARTIELLE" -> "PARTIELLE";
            case "INDISPONIBLE", "" -> "INDISPONIBLE";
            default -> throw new BusinessException("Impact disponibilite invalide : " + impact);
        };
    }

    private void syncAvailabilityIfCurrent(Collaborateur collaborateur, Conge conge) {
        LocalDate today = LocalDate.now();
        if (conge.getDateDebut().isAfter(today) || conge.getDateFin().isBefore(today)) {
            return;
        }

        String statut = "PARTIELLE".equals(conge.getImpactDisponibilite()) ? "Partielle" : "Indisponible";
        collaborateur.setDisponible("PARTIELLE".equals(conge.getImpactDisponibilite()));
        collaborateurRepository.save(collaborateur);

        DisponibiliteUtilisateur disponibilite = disponibiliteUtilisateurRepository
                .findByUserId(collaborateur.getId())
                .orElseGet(() -> DisponibiliteUtilisateur.builder().userId(collaborateur.getId()).build());

        disponibilite.setStatut(statut);
        disponibiliteUtilisateurRepository.save(disponibilite);
    }

    private String resolveAvailabilityState(Collaborateur collaborateur, List<PlanningLeaveResponse> conges) {
        LocalDate today = LocalDate.now();
        String impact = conges.stream()
                .filter(conge -> !conge.getDateDebut().isAfter(today) && !conge.getDateFin().isBefore(today))
                .map(PlanningLeaveResponse::getImpactDisponibilite)
                .map(value -> value == null ? "" : value.trim().toUpperCase())
                .findFirst()
                .orElse("");

        if ("PARTIELLE".equals(impact)) {
            return "partielle";
        }
        if ("INDISPONIBLE".equals(impact)) {
            return "indisponible";
        }

        return collaborateur.isDisponible() ? "disponible" : "indisponible";
    }

    private String resolveAvailabilityMessage(Collaborateur collaborateur, List<PlanningLeaveResponse> conges) {
        LocalDate today = LocalDate.now();
        return conges.stream()
                .filter(conge -> !conge.getDateFin().isBefore(today))
                .findFirst()
                .map(conge -> String.format("%s du %s au %s", conge.getLibelle(), conge.getDateDebut(), conge.getDateFin()))
                .orElse(collaborateur.isDisponible()
                        ? "Disponible pour les missions en cours et a venir."
                        : "Disponibilite limitee, verifier le planning avant une nouvelle affectation.");
    }
}
