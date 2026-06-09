package com.smartassign.pfe.dto;

import java.util.List;

public final class ManagerDashboardDto {

    private ManagerDashboardDto() {
    }

    public record Stats(
        long projetsActifs,
        long ressourcesDisponibles,
        long affectationsEnCours,
        long tauxAffectation,
        long alertesPrioritaires,
        double compatibiliteIa,
        long totalCollaborateurs,
        long projetsEnRetard,
        long collaborateursSurcharges
    ) {
    }

    public record Alerte(
        String type,
        String title,
        String description,
        String link
    ) {
    }

    public record AlertsResponse(
        long total,
        List<Alerte> items
    ) {
    }
}
