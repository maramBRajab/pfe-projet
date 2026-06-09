package com.smartassign.pfe.dto;

import java.util.List;

public final class CollaborateurDashboardDto {

    private CollaborateurDashboardDto() {
    }

    public record Response(
        Long collaborateurId,
        String collaborateurNom,
        long projetsActifs,
        Disponibilite disponibilite,
        long competencesCount,
        int chargeMoyenne,
        List<Jalon> prochainsJalons,
        PointsVigilance pointsVigilance,
        List<JournalEntry> journalEntries,
        List<Activite> activiteRecente
    ) {
    }

    public record Disponibilite(
        String etat,
        String message,
        String dateDebut,
        String dateFin
    ) {
    }

    public record Jalon(
        String projet,
        String jalon,
        String dateEcheance,
        String statut,
        int charge
    ) {
    }

    public record PointsVigilance(long count, List<String> entries) {
    }

    public record JournalEntry(
        String action,
        String date,
        String details
    ) {
    }

    public record Activite(
        String initiales,
        String action,
        String temps,
        String categorie,
        String createdAt
    ) {
    }
}