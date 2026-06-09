package com.smartassign.pfe.dto;

import java.util.Set;
import jakarta.validation.constraints.*;
import lombok.*;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class CollaborateurRequest {

    @NotBlank(message = "Le nom est obligatoire")
    private String nom;

    @NotBlank(message = "Le prénom est obligatoire")
    private String prenom;

    @NotBlank(message = "L'email est obligatoire")
    @Email(message = "Email invalide")
    private String email;

    @NotBlank(message = "Le téléphone est obligatoire")
    @Pattern(regexp = "^\\d{8}$", message = "Le téléphone doit contenir exactement 8 chiffres")
    private String telephone;

    private String role;

    private String departement;

    @Min(value = 0, message = "L'expérience doit être positive")
    private int experienceAnnees;

    @Builder.Default
    private boolean disponible = true;

    private String photoUrl;

    private Set<Long> competenceIds;
}