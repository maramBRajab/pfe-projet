package com.smartassign.pfe.controller;

import java.util.List;
import java.util.Locale;
import java.util.Map;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.security.core.Authentication;

import com.smartassign.pfe.dto.CollaborateurResponse;
import com.smartassign.pfe.service.AuditLogService;
import com.smartassign.pfe.service.CollaborateurService;
import com.smartassign.pfe.service.RhDashboardService;

import jakarta.servlet.http.HttpServletRequest;

import lombok.RequiredArgsConstructor;

@RestController
@RequestMapping("/api/admin/utilisateurs")
@RequiredArgsConstructor
public class AdminUtilisateurController {

    private final CollaborateurService collaborateurService;
    private final AuditLogService auditLogService;
    private final RhDashboardService rhDashboardService;
    private final HttpServletRequest httpRequest;

    @GetMapping
    public ResponseEntity<List<CollaborateurResponse>> getAllUsers() {
        return ResponseEntity.ok(collaborateurService.getAllUsers());
    }

    @PatchMapping("/{id}/statut")
    public ResponseEntity<CollaborateurResponse> updateStatut(
        @PathVariable Long id,
        @RequestBody Map<String, String> payload,
        Authentication authentication
    ) {
        String requestedStatut = payload.get("statut");
        CollaborateurResponse updated = collaborateurService.updateStatutCompte(id, requestedStatut);

        String normalized = requestedStatut == null ? "ACTIF" : requestedStatut.trim().toUpperCase(Locale.ROOT);
        String action = "SUSPENDU".equals(normalized) ? "SUSPENSION" : "ACTIVATION";

        auditLogService.log(
            authentication != null ? authentication.getName() : "system",
            "ADMIN",
            action,
            "Controle d'acces: " + action + " du compte utilisateur " + updated.getPrenom() + " " + updated.getNom(),
            httpRequest.getRemoteAddr(),
            "SUCCESS",
            updated.getStatutCompte(),
            updated.getEmail()
        );

        rhDashboardService.logJournalAction(
            action,
            authentication != null ? authentication.getName() : "system",
            "Evenement RH: " + action + " du compte " + updated.getPrenom() + " " + updated.getNom() + " (" + updated.getEmail() + ")"
        );

        return ResponseEntity.ok(updated);
    }
}
