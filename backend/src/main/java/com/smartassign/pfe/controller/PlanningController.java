package com.smartassign.pfe.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.smartassign.pfe.dto.CollaborateurPlanningResponse;
import com.smartassign.pfe.dto.PlanningLeaveRequest;
import com.smartassign.pfe.dto.PlanningLeaveResponse;
import com.smartassign.pfe.dto.PlanningTaskResponse;
import com.smartassign.pfe.dto.TaskStatusUpdateRequest;
import com.smartassign.pfe.service.PlanningService;
import com.smartassign.pfe.service.RhDashboardService;

import org.springframework.security.core.Authentication;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;

@RestController
@RequestMapping("/api/planning")
@RequiredArgsConstructor
public class PlanningController {

    private final PlanningService planningService;
    private final RhDashboardService rhDashboardService;

    @GetMapping("/collaborateur/{collaborateurId}")
    public ResponseEntity<CollaborateurPlanningResponse> getByCollaborateur(@PathVariable Long collaborateurId) {
        return ResponseEntity.ok(planningService.getByCollaborateur(collaborateurId));
    }

    @PatchMapping("/collaborateur/{collaborateurId}/taches/{taskId}/statut")
    public ResponseEntity<PlanningTaskResponse> updateTaskStatus(
            @PathVariable Long collaborateurId,
            @PathVariable Long taskId,
            @Valid @RequestBody TaskStatusUpdateRequest request,
            Authentication authentication) {
        PlanningTaskResponse response = planningService.updateTaskStatus(collaborateurId, taskId, request.getStatut());
        rhDashboardService.logJournalAction(
                "MISE_A_JOUR_TACHE",
                authentication != null ? authentication.getName() : "system",
                "Tache " + response.getTitre() + " -> " + response.getStatut());
        return ResponseEntity.ok(response);
    }

    @PostMapping("/collaborateur/{collaborateurId}/conges")
    public ResponseEntity<PlanningLeaveResponse> createConge(
            @PathVariable Long collaborateurId,
            @Valid @RequestBody PlanningLeaveRequest request,
            Authentication authentication) {
        PlanningLeaveResponse response = planningService.createConge(collaborateurId, request);
        rhDashboardService.logJournalAction(
                "DEMANDE_CONGE",
                authentication != null ? authentication.getName() : "system",
                response.getLibelle() + " du " + response.getDateDebut() + " au " + response.getDateFin());
        return ResponseEntity.ok(response);
    }
}
