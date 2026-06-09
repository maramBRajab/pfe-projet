package com.smartassign.pfe.dto;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

public final class CollaborateurMesProjetsDto {

    private CollaborateurMesProjetsDto() {
    }

    public record ProjetItem(
        Long affectationId,
        Long projetId,
        String projetNom,
        String projetDescription,
        String statut,
        LocalDate dateDebut,
        LocalDate dateFin,
        LocalDateTime dateAffectation,
        double scoreCompatibilite,
        List<String> competencesRequises,
        int membersCount,
        List<String> teamMembers,
        String roleCollaborateur
    ) {
    }
}