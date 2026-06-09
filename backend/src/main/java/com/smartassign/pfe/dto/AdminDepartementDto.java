package com.smartassign.pfe.dto;

public final class AdminDepartementDto {

    private AdminDepartementDto() {
    }

    public record CollaborateurDepartementRow(
        Long id,
        String nom,
        String email,
        String departement
    ) {
    }

    public record UpdateDepartementRequest(
        Long userId,
        String departement
    ) {
    }
}
