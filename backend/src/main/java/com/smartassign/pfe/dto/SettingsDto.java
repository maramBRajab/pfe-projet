package com.smartassign.pfe.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import lombok.*;

import java.time.LocalDateTime;

/**
 * DTO principal pour GET /api/admin/settings et PUT /api/admin/settings.
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class SettingsDto {

    @Valid
    private AffectationsDto affectations;

    @Valid
    private PlateformeDto plateforme;

    private MetaDto meta;

    // ── Sous-objets ───────────────────────────────────────────

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class AffectationsDto {

        @NotNull(message = "Le seuil de compatibilité est requis")
        @Min(value = 0,   message = "Le seuil doit être ≥ 0")
        @Max(value = 100, message = "Le seuil doit être ≤ 100")
        private Integer seuilCompatibilite;

        @NotNull(message = "Le nombre max de profils est requis")
        @Min(value = 1,  message = "Le nombre max doit être ≥ 1")
        @Max(value = 20, message = "Le nombre max doit être ≤ 20")
        private Integer maxProfilsRecommandes;

        @NotNull(message = "Le matching automatique est requis")
        private Boolean matchingAutomatique;
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class PlateformeDto {

        @NotBlank(message = "Le nom de la plateforme est requis")
        @Size(max = 50, message = "Le nom ne doit pas dépasser 50 caractères")
        private String nomPlateforme;

        @NotNull(message = "Le mode maintenance est requis")
        private Boolean modeMaintenance;
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class MetaDto {
        private LocalDateTime derniereModification;
        private String modifiePar;
    }
}
