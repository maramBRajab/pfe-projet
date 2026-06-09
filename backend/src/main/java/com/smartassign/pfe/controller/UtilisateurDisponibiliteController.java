package com.smartassign.pfe.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.smartassign.pfe.dto.UtilisateurDisponibiliteResponse;
import com.smartassign.pfe.service.PlanningService;

import lombok.RequiredArgsConstructor;

@RestController
@RequestMapping("/api/utilisateurs")
@RequiredArgsConstructor
public class UtilisateurDisponibiliteController {

    private final PlanningService planningService;

    @GetMapping("/{id}/disponibilite")
    public ResponseEntity<UtilisateurDisponibiliteResponse> getDisponibilite(@PathVariable Long id) {
        return ResponseEntity.ok(planningService.getDisponibiliteByUtilisateur(id));
    }
}
