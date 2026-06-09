package com.smartassign.pfe.service;

import java.time.LocalDate;
import java.util.List;

import com.smartassign.pfe.dto.CollaborateurPlanningResponse;
import com.smartassign.pfe.dto.PlanningLeaveRequest;
import com.smartassign.pfe.dto.PlanningLeaveResponse;
import com.smartassign.pfe.dto.PlanningTaskResponse;
import com.smartassign.pfe.dto.UtilisateurDisponibiliteResponse;

public interface PlanningService {

    CollaborateurPlanningResponse getByCollaborateur(Long collaborateurId);

    List<PlanningTaskResponse> getTasksByCollaborateur(Long collaborateurId, LocalDate dateDebut, LocalDate dateFin);

    List<PlanningLeaveResponse> getCongesByCollaborateur(Long collaborateurId);

    UtilisateurDisponibiliteResponse getDisponibiliteByUtilisateur(Long userId);

    PlanningTaskResponse updateTaskStatus(Long collaborateurId, Long taskId, String statut);

    PlanningLeaveResponse createConge(Long collaborateurId, PlanningLeaveRequest request);
}
