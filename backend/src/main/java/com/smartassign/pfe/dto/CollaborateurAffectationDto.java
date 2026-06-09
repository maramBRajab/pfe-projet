package com.smartassign.pfe.dto;

import java.time.LocalDateTime;

import com.fasterxml.jackson.annotation.JsonProperty;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class CollaborateurAffectationDto {
    private Long id;
    private String projet;
    private double score;

    @JsonProperty("date_affectation")
    private LocalDateTime dateAffectation;

    private String statut;

    @JsonProperty("manager_nom")
    private String managerNom;
}
