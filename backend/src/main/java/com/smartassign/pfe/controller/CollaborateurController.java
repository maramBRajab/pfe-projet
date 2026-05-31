package com.smartassign.pfe.controller;

import java.util.List;
import java.util.Map;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import com.smartassign.pfe.dto.CollaborateurRequest;
import com.smartassign.pfe.dto.CollaborateurResponse;
import com.smartassign.pfe.service.CollaborateurService;
import com.smartassign.pfe.service.AuditLogService;
import jakarta.servlet.http.HttpServletRequest;

import org.springframework.security.core.Authentication;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;

@RestController
@RequestMapping({ "/api/collaborateurs", "/api/admin/collaborateurs" })
@RequiredArgsConstructor
public class CollaborateurController {

    private final CollaborateurService service;
    private final AuditLogService auditLogService;
    private final HttpServletRequest httpRequest;

    @GetMapping
    public ResponseEntity<List<CollaborateurResponse>> getAll() {
        return ResponseEntity.ok(service.getAll());
    }

    @GetMapping("/{id}")
    public ResponseEntity<CollaborateurResponse> getById(@PathVariable Long id) {
        return ResponseEntity.ok(service.getById(id));
    }

    @GetMapping("/search/by-email")
    public ResponseEntity<CollaborateurResponse> getByEmail(@RequestParam String email) {
        return ResponseEntity.ok(service.getByEmail(email));
    }

    @GetMapping("/disponibles")
    public ResponseEntity<List<CollaborateurResponse>> getDisponibles() {
        return ResponseEntity.ok(service.getDisponibles());
    }

    @PostMapping
    public ResponseEntity<CollaborateurResponse> create(
            @Valid @RequestBody CollaborateurRequest request,
            Authentication authentication) {
        CollaborateurResponse created = service.create(request);
        auditLogService.log(authentication.getName(), "ADMIN", "CREATE_USER", "Création du collaborateur " + created.getNom(), httpRequest.getRemoteAddr(), "SUCCESS", null, created.getEmail());
        return ResponseEntity.status(HttpStatus.CREATED).body(created);
    }

    @PutMapping("/{id}")
    public ResponseEntity<CollaborateurResponse> update(
            @PathVariable Long id,
            @Valid @RequestBody CollaborateurRequest request,
            Authentication authentication) {
        CollaborateurResponse updated = service.update(id, request);
        auditLogService.log(authentication.getName(), "ADMIN", "UPDATE_USER", "Mise à jour du collaborateur " + updated.getNom(), httpRequest.getRemoteAddr(), "SUCCESS", null, updated.getEmail());
        return ResponseEntity.ok(updated);
    }

    @PatchMapping("/{id}/role")
    public ResponseEntity<CollaborateurResponse> updateRole(
            @PathVariable Long id,
            @RequestBody Map<String, String> payload,
            Authentication authentication) {
        CollaborateurResponse updated = service.updateRole(id, payload.get("role"));
        auditLogService.log(authentication.getName(), "ADMIN", "ROLE_CHANGE", "Changement de rôle → " + payload.get("role") + " pour " + updated.getNom(), httpRequest.getRemoteAddr(), "SUCCESS", null, updated.getEmail());
        return ResponseEntity.ok(updated);
    }

    @PatchMapping("/{id}/disponibilite")
    public ResponseEntity<CollaborateurResponse> toggleDisponibilite(@PathVariable Long id) {
        return ResponseEntity.ok(service.toggleDisponibilite(id));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id, Authentication authentication) {
        CollaborateurResponse collab = service.getById(id);
        service.delete(id);
        auditLogService.log(authentication.getName(), "ADMIN", "DELETE_USER", "Suppression du collaborateur " + collab.getNom(), httpRequest.getRemoteAddr(), "SUCCESS", null, collab.getEmail());
        return ResponseEntity.noContent().build();
    }
}