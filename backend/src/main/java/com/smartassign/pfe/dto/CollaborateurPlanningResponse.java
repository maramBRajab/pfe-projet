package com.smartassign.pfe.dto;

import java.util.List;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class CollaborateurPlanningResponse {
    private CollaborateurResponse collaborateur;
    private String disponibiliteEtat;
    private String disponibiliteMessage;
    private List<AffectationResponse> affectations;
    private List<PlanningTaskResponse> taches;
    private List<PlanningLeaveResponse> conges;
}