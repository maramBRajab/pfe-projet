package com.smartassign.pfe.dto;

import java.time.LocalDateTime;
import lombok.*;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class AffectationResponse {
    private Long                 id;
    private ProjetResponse       projet;
    private CollaborateurResponse collaborateur;
    private double               score;
    private String               potentiel;
    private LocalDateTime        dateAffectation;
}