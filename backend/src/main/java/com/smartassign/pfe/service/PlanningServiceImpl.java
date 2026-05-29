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
import com.smartassign.pfe.dto.PlanningTaskResponse;
import com.smartassign.pfe.dto.ProjetResponse;
import com.smartassign.pfe.entity.Affectation;
import com.smartassign.pfe.entity.Collaborateur;
import com.smartassign.pfe.entity.Conge;
import com.smartassign.pfe.entity.Tache;
import com.smartassign.pfe.exception.ResourceNotFoundException;
import com.smartassign.pfe.repository.AffectationRepository;
import com.smartassign.pfe.repository.CollaborateurRepository;
import com.smartassign.pfe.repository.CongeRepository;
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

    private AffectationResponse toAffectationResponse(Affectation affectation) {
        CollaborateurResponse collaborateur = collaborateurService.toResponse(affectation.getCollaborateur());
        ProjetResponse projet = projetService.toResponse(affectation.getProjet());

        return AffectationResponse.builder()
                .id(affectation.getId())
                .projet(projet)
                .collaborateur(collaborateur)
                .score(affectation.getScore())
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