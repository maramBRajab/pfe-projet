package com.smartassign.pfe.entity;

import jakarta.persistence.*;
import jakarta.validation.constraints.*;
import lombok.*;

import java.time.LocalDateTime;

/**
 * Singleton de configuration de la plateforme.
 * Une seule ligne en base (id = 1), créée au démarrage si absente.
 */
@Entity
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@Table(name = "settings")
public class Settings {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    // ── Affectations ──────────────────────────────────────────
    @Builder.Default
    @Min(0) @Max(100)
    @Column(name = "seuil_compatibilite", nullable = false)
    private Integer seuilCompatibilite = 75;

    @Builder.Default
    @Min(1) @Max(20)
    @Column(name = "max_profils_recommandes", nullable = false)
    private Integer maxProfilsRecommandes = 5;

    @Builder.Default
    @Column(name = "matching_automatique", nullable = false)
    private Boolean matchingAutomatique = true;

    // ── Plateforme ────────────────────────────────────────────
    @Builder.Default
    @NotBlank
    @Size(max = 50)
    @Column(name = "nom_plateforme", nullable = false, length = 50)
    private String nomPlateforme = "SmartAssign";

    @Builder.Default
    @Column(name = "mode_maintenance", nullable = false)
    private Boolean modeMaintenance = false;

    // ── Méta ──────────────────────────────────────────────────
    @Column(name = "derniere_modification")
    private LocalDateTime derniereModification;

    @Column(name = "modifie_par")
    private String modifiePar;
}
