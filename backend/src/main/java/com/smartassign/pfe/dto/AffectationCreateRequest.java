package com.smartassign.pfe.dto;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PositiveOrZero;
import lombok.*;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class AffectationCreateRequest {

    @NotNull(message = "L'identifiant du collaborateur est obligatoire")
    private Long collaborateurId;

    @NotNull(message = "L'identifiant du projet est obligatoire")
    private Long projetId;

    @PositiveOrZero(message = "Le score doit etre positif")
    private Double score;
}
