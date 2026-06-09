package com.smartassign.pfe.entity;

import java.time.LocalDateTime;

import jakarta.persistence.*;
import jakarta.validation.constraints.*;
import lombok.*;

@Entity
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@Table(name = "utilisateurs")
public class Utilisateur {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @NotBlank(message = "Le nom est obligatoire")
    private String nom;

    @NotBlank(message = "L'email est obligatoire")
    @Email(message = "L'email est invalide")
    @Column(name = "email", unique = true, nullable = false)
    private String email;

    @NotBlank(message = "Le mot de passe est obligatoire")
    @Column(name = "mot_de_passe", nullable = false)
    private String motDePasse;

    @Builder.Default
    private String role = "COLLAB";

    private String telephone;
    private String poste;
    private String departement;

    @Column(name = "photo_url", columnDefinition = "TEXT")
    private String photoUrl;

    @Builder.Default
    private String uiTheme = "dark";

    @Builder.Default
    private String uiLanguage = "fr";

    @Builder.Default
    private String uiDisplayDensity = "extended";

    @Builder.Default
    private Boolean notificationsEnabled = true;

    @Builder.Default
    private Boolean urgentAlerts = true;

    @Builder.Default
    private Boolean projectUpdates = true;

    @Builder.Default
    private Boolean actif = true;

    @Builder.Default
    @Column(name = "email_verifie")
    private Boolean emailVerifie = false;

    @Column(name = "email_verifie_le")
    private LocalDateTime emailVerifieLe;

    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    @PrePersist
    private void onCreate() {
        if (createdAt == null) {
            createdAt = LocalDateTime.now();
        }
    }

    // valeurs : "ADMIN" | "MANAGER" | "COLLAB"
}