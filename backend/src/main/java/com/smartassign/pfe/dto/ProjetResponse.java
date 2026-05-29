package com.smartassign.pfe.dto;

import java.time.LocalDate;
import java.util.Set;
import lombok.*;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ProjetResponse {
    private Long      id;
    private String    nom;
    private String    description;
    private LocalDate dateDebut;
    private LocalDate dateFin;
    private String    statut;
    private Set<CompetenceResponse> competencesRequises;
}