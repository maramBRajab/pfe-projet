package com.smartassign.pfe.controller;

import java.util.List;
import java.util.Map;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import com.smartassign.pfe.dto.ProjetRequest;
import com.smartassign.pfe.dto.ProjetResponse;
import com.smartassign.pfe.service.ProjetService;
import com.smartassign.pfe.service.AuditLogService;
import com.smartassign.pfe.service.NotificationGeneratorService;
import jakarta.servlet.http.HttpServletRequest;

import org.springframework.security.core.Authentication;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;

@RestController
@RequestMapping({ "/api/projets", "/api/admin/projets" })
@RequiredArgsConstructor
public class ProjetController {

    private final ProjetService service;
    private final AuditLogService auditLogService;
    private final NotificationGeneratorService notificationGeneratorService;
    private final HttpServletRequest httpRequest;

    @GetMapping
    public ResponseEntity<List<ProjetResponse>> getAll() {
        return ResponseEntity.ok(service.getAll());
    }

    @GetMapping("/{id}")
    public ResponseEntity<ProjetResponse> getById(@PathVariable Long id) {
        return ResponseEntity.ok(service.getById(id));
    }

    @GetMapping("/statut/{statut}")
    public ResponseEntity<List<ProjetResponse>> getByStatut(@PathVariable String statut) {
        return ResponseEntity.ok(service.getByStatut(statut));
    }

    @PostMapping
    public ResponseEntity<ProjetResponse> create(
            @Valid @RequestBody ProjetRequest request,
            Authentication authentication) {
        ProjetResponse created = service.create(request);
        notificationGeneratorService.createProjectCreatedNotification(created.getNom(), created.getId());
        notificationGeneratorService.generateSystemNotifications();
        auditLogService.log(authentication.getName(), "ADMIN", "CREATE_PROJET", "Création du projet \"" + created.getNom() + "\"", httpRequest.getRemoteAddr(), "SUCCESS", null, created.getNom());
        return ResponseEntity.status(HttpStatus.CREATED).body(created);
    }

    @PutMapping("/{id}")
    public ResponseEntity<ProjetResponse> update(
            @PathVariable Long id,
            @Valid @RequestBody ProjetRequest request,
            Authentication authentication) {
        ProjetResponse updated = service.update(id, request);
        notificationGeneratorService.generateSystemNotifications();
        auditLogService.log(authentication.getName(), "ADMIN", "UPDATE_PROJET", "Mise à jour du projet \"" + updated.getNom() + "\"", httpRequest.getRemoteAddr(), "SUCCESS", null, updated.getNom());
        return ResponseEntity.ok(updated);
    }

    @PatchMapping("/{id}/statut")
    public ResponseEntity<ProjetResponse> updateStatut(
            @PathVariable Long id,
            @RequestBody Map<String, String> payload,
            Authentication authentication) {
        ProjetResponse updated = service.updateStatut(id, payload.get("statut"));
        notificationGeneratorService.generateSystemNotifications();
        auditLogService.log(authentication.getName(), "ADMIN", "UPDATE_PROJET", "Statut du projet \"" + updated.getNom() + "\" → " + payload.get("statut"), httpRequest.getRemoteAddr(), "SUCCESS", null, updated.getNom());
        return ResponseEntity.ok(updated);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id, Authentication authentication) {
        ProjetResponse projet = service.getById(id);
        service.delete(id);
        notificationGeneratorService.createProjectDeletedNotification(projet.getNom());
        auditLogService.log(authentication.getName(), "ADMIN", "DELETE_PROJET", "Suppression du projet \"" + projet.getNom() + "\"", httpRequest.getRemoteAddr(), "SUCCESS", null, projet.getNom());
        return ResponseEntity.noContent().build();
    }
}