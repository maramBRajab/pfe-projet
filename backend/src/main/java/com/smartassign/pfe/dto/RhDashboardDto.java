package com.smartassign.pfe.dto;

public final class RhDashboardDto {

    private RhDashboardDto() {
    }

    public record JalonItem(
        Long id,
        String titre,
        String description,
        String date,
        String statut,
        Long userId
    ) {
    }

    public record ActiviteItem(
        Long id,
        String type,
        String message,
        String date,
        Long userId
    ) {
    }

    public record JournalItem(
        Long id,
        String action,
        String utilisateur,
        String date,
        String details
    ) {
    }

    public record DisponibiliteItem(
        Long userId,
        String statut
    ) {
    }
}