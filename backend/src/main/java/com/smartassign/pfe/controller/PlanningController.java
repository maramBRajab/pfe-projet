package com.smartassign.pfe.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.smartassign.pfe.dto.CollaborateurPlanningResponse;
import com.smartassign.pfe.service.PlanningService;

import lombok.RequiredArgsConstructor;

@RestController
@RequestMapping("/api/planning")
@RequiredArgsConstructor
public class PlanningController {

    private final PlanningService planningService;

    @GetMapping("/collaborateur/{collaborateurId}")
    public ResponseEntity<CollaborateurPlanningResponse> getByCollaborateur(@PathVariable Long collaborateurId) {
        return ResponseEntity.ok(planningService.getByCollaborateur(collaborateurId));
    }
}