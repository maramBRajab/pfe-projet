package com.smartassign.pfe.dto;

import java.time.LocalDate;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class PlanningTaskResponse {
    private Long id;
    private String titre;
    private String description;
    private LocalDate dateEcheance;
    private String statut;
    private String priorite;
    private Long projetId;
    private String projetNom;
}