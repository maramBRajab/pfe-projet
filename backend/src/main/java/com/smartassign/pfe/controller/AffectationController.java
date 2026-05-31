package com.smartassign.pfe.controller;

import java.util.List;
import java.util.Map;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import com.smartassign.pfe.dto.AffectationCreateRequest;
import com.smartassign.pfe.dto.AffectationResponse;
import com.smartassign.pfe.service.AffectationService;
import com.smartassign.pfe.service.AuditLogService;
import jakarta.servlet.http.HttpServletRequest;

import org.springframework.security.core.Authentication;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;

@RestController
@RequestMapping("/api/affectations")
@RequiredArgsConstructor
public class AffectationController {

    private final AffectationService service;
    private final AuditLogService auditLogService;
    private final HttpServletRequest httpRequest;

    // ⭐ Lancer l'algorithme d'affectation
    @PostMapping("/lancer/{projetId}")
    public ResponseEntity<List<AffectationResponse>> lancer(
            @PathVariable Long projetId,
            Authentication authentication) {
        List<AffectationResponse> result = service.lancerAffectation(projetId);
        auditLogService.log(authentication.getName(), "ADMIN", "ASSIGN", "Algorithme d'affectation lancé pour le projet #" + projetId + " → " + result.size() + " affectation(s)", httpRequest.getRemoteAddr(), "SUCCESS", null, "Projet #" + projetId);
        return ResponseEntity.ok(result);
    }

    // ⭐ Créer une affectation unitaire (depuis le bouton "Affecter")
    @PostMapping
    public ResponseEntity<AffectationResponse> create(
            @Valid @RequestBody AffectationCreateRequest request,
            Authentication authentication) {
        AffectationResponse response = service.create(request);
        auditLogService.log(authentication.getName(), "ADMIN", "ASSIGN", "Affectation manuelle : collaborateur #" + request.getCollaborateurId() + " → projet #" + request.getProjetId(), httpRequest.getRemoteAddr(), "SUCCESS", null, "Projet #" + request.getProjetId());
        return ResponseEntity
                .status(org.springframework.http.HttpStatus.CREATED)
                .body(response);
    }

    @GetMapping
    public ResponseEntity<List<AffectationResponse>> getAll() {
        return ResponseEntity.ok(service.getAll());
    }

    @GetMapping("/projet/{projetId}")
    public ResponseEntity<List<AffectationResponse>> getByProjet(
            @PathVariable Long projetId) {
        return ResponseEntity.ok(service.getByProjet(projetId));
    }

    @GetMapping("/collaborateur/{collaborateurId}")
    public ResponseEntity<List<AffectationResponse>> getByCollaborateur(
            @PathVariable Long collaborateurId) {
        return ResponseEntity.ok(service.getByCollaborateur(collaborateurId));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id, Authentication authentication) {
        AffectationResponse aff = service.getById(id);
        service.delete(id);
        auditLogService.log(authentication.getName(), "ADMIN", "UNASSIGN", "Suppression de l'affectation #" + id, httpRequest.getRemoteAddr(), "SUCCESS", null, "Affectation #" + id);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/{id}")
    public ResponseEntity<AffectationResponse> getById(@PathVariable Long id) {
        return ResponseEntity.ok(service.getById(id));
    }

    @PutMapping("/{id}")
    public ResponseEntity<AffectationResponse> update(
            @PathVariable Long id,
            @RequestBody Map<String, Long> body) {
        return ResponseEntity.ok(service.update(id, body.get("collaborateurId")));
    }
}