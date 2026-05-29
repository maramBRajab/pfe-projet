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
public class PlanningLeaveResponse {
    private Long id;
    private String libelle;
    private String type;
    private LocalDate dateDebut;
    private LocalDate dateFin;
    private String impactDisponibilite;
}