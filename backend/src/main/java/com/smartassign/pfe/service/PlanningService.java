package com.smartassign.pfe.service;

import com.smartassign.pfe.dto.CollaborateurPlanningResponse;

public interface PlanningService {

    CollaborateurPlanningResponse getByCollaborateur(Long collaborateurId);
}
