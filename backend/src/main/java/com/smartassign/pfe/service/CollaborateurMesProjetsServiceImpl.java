package com.smartassign.pfe.service;

import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.Objects;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import com.smartassign.pfe.dto.CollaborateurMesProjetsDto;
import com.smartassign.pfe.entity.Affectation;
import com.smartassign.pfe.entity.Collaborateur;
import com.smartassign.pfe.exception.ResourceNotFoundException;
import com.smartassign.pfe.repository.AffectationRepository;
import com.smartassign.pfe.repository.CollaborateurRepository;

import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class CollaborateurMesProjetsServiceImpl implements CollaborateurMesProjetsService {

    private final CollaborateurRepository collaborateurRepository;
    private final AffectationRepository affectationRepository;

    @Override
    public List<CollaborateurMesProjetsDto.ProjetItem> getMesProjets(Long requestedCollaborateurId, String authenticatedEmail) {
        String normalizedEmail = normalizeEmail(authenticatedEmail);
        if (normalizedEmail.isBlank()) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Session utilisateur invalide.");
        }

        Collaborateur connectedCollaborateur = collaborateurRepository.findByEmailIgnoreCase(normalizedEmail)
            .orElseThrow(() -> new ResourceNotFoundException("Collaborateur introuvable pour l'email : " + normalizedEmail));

        Long effectiveCollaborateurId = Objects.equals(connectedCollaborateur.getId(), requestedCollaborateurId)
            ? requestedCollaborateurId
            : connectedCollaborateur.getId();

        return affectationRepository.findByCollaborateurId(effectiveCollaborateurId).stream()
            .sorted(Comparator.comparing(Affectation::getDateAffectation).reversed())
            .map(affectation -> {
                Long projetId = affectation.getProjet().getId();
                List<Affectation> allProjectAffectations = affectationRepository.findByProjetId(projetId);

                List<String> teamMembers = allProjectAffectations.stream()
                    .map(a -> a.getCollaborateur().getPrenom() + " " + a.getCollaborateur().getNom())
                    .distinct()
                    .limit(5)
                    .toList();

                List<String> competences = affectation.getProjet().getCompetencesRequises().stream()
                    .map(competence -> competence.getNom())
                    .toList();

                return new CollaborateurMesProjetsDto.ProjetItem(
                    affectation.getId(),
                    projetId,
                    affectation.getProjet().getNom(),
                    affectation.getProjet().getDescription(),
                    affectation.getProjet().getStatut(),
                    affectation.getProjet().getDateDebut(),
                    affectation.getProjet().getDateFin(),
                    affectation.getDateAffectation(),
                    affectation.getScore(),
                    competences,
                    teamMembers.size(),
                    teamMembers,
                    safeRole(connectedCollaborateur.getRole())
                );
            })
            .toList();
    }

    private String normalizeEmail(String email) {
        return email == null ? "" : email.trim().toLowerCase(Locale.FRENCH);
    }

    private String safeRole(String role) {
        return role == null || role.isBlank() ? "COLLAB" : role;
    }
}