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

    @Email(message = "Email invalide")
    private String email;

    private String role;

    @Min(value = 0, message = "L'expérience doit être positive")
    private int experienceAnnees;

    @Builder.Default
    private boolean disponible = true;

    private Set<Long> competenceIds;
}