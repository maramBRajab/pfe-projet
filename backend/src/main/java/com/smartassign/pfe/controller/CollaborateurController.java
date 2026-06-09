package com.smartassign.pfe.controller;

import java.util.List;
import java.util.Map;
import java.time.LocalDate;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import com.smartassign.pfe.dto.CollaborateurRequest;
import com.smartassign.pfe.dto.CollaborateurResponse;
import com.smartassign.pfe.dto.MessageResponse;
import com.smartassign.pfe.dto.CollaborateurDashboardDto;
import com.smartassign.pfe.dto.CollaborateurAffectationDto;
import com.smartassign.pfe.dto.MesProjetsDto;
import com.smartassign.pfe.dto.PlanningLeaveResponse;
import com.smartassign.pfe.dto.PlanningTaskResponse;
import com.smartassign.pfe.dto.NotificationSummaryDto;
import com.smartassign.pfe.service.CollaborateurService;
import com.smartassign.pfe.service.CollaborateurDashboardService;
import com.smartassign.pfe.service.CollaborateurNotificationService;
import com.smartassign.pfe.service.AuditLogService;
import com.smartassign.pfe.service.NotificationGeneratorService;
import com.smartassign.pfe.service.RhDashboardService;
import com.smartassign.pfe.service.AffectationService;
import com.smartassign.pfe.service.PlanningService;
import com.smartassign.pfe.dto.AffectationResponse;
import jakarta.servlet.http.HttpServletRequest;

import org.springframework.security.core.Authentication;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;

@RestController
@RequestMapping({ "/api/collaborateurs", "/api/admin/collaborateurs" })
@RequiredArgsConstructor
public class CollaborateurController {

    private final CollaborateurService service;
    private final CollaborateurDashboardService dashboardService;
    private final CollaborateurNotificationService notificationService;
    private final RhDashboardService rhDashboardService;
    private final AuditLogService auditLogService;
    private final NotificationGeneratorService notificationGeneratorService;
    private final HttpServletRequest httpRequest;
    private final AffectationService affectationService;
    private final PlanningService planningService;

    @GetMapping
    public ResponseEntity<List<CollaborateurResponse>> getAll() {
        return ResponseEntity.ok(service.getAll());
    }

    @GetMapping("/{id}")
    public ResponseEntity<CollaborateurResponse> getById(@PathVariable Long id) {
        return ResponseEntity.ok(service.getById(id));
    }

    @GetMapping("/{id}/dashboard")
    public ResponseEntity<CollaborateurDashboardDto.Response> getDashboard(
        @PathVariable Long id,
        Authentication authentication
    ) {
        return ResponseEntity.ok(dashboardService.getDashboard(id, authentication != null ? authentication.getName() : null));
    }

    @GetMapping("/{id}/mes-projets")
    public ResponseEntity<MesProjetsDto> getMesProjets(
        @PathVariable Long id,
        Authentication authentication
    ) {
        return ResponseEntity.ok(service.getMesProjets(id, authentication != null ? authentication.getName() : null));
    }

    @GetMapping("/{id}/historique")
    public ResponseEntity<List<AffectationResponse>> getHistorique(@PathVariable Long id) {
        return ResponseEntity.ok(affectationService.getHistoriqueByCollaborateur(id));
    }

    @GetMapping("/{id}/affectations")
    public ResponseEntity<List<CollaborateurAffectationDto>> getAffectations(
        @PathVariable Long id,
        Authentication authentication
    ) {
        return ResponseEntity.ok(affectationService.getResumeByCollaborateur(id));
    }

    @GetMapping("/{id}/taches")
    public ResponseEntity<List<PlanningTaskResponse>> getTaches(
        @PathVariable Long id,
        @RequestParam(name = "date_debut", required = false) LocalDate dateDebut,
        @RequestParam(name = "date_fin", required = false) LocalDate dateFin
    ) {
        return ResponseEntity.ok(planningService.getTasksByCollaborateur(id, dateDebut, dateFin));
    }

    @GetMapping("/{id}/conges")
    public ResponseEntity<List<PlanningLeaveResponse>> getConges(@PathVariable Long id) {
        return ResponseEntity.ok(planningService.getCongesByCollaborateur(id));
    }

    @GetMapping("/{id}/notifications")
    public ResponseEntity<NotificationSummaryDto> getNotifications(@PathVariable Long id) {
        return ResponseEntity.ok(notificationService.getNotifications(id));
    }

    @PostMapping("/{id}/notifications/{key}/dismiss")
    public ResponseEntity<Void> dismissNotification(@PathVariable Long id, @PathVariable String key) {
        notificationService.dismissNotification(id, key);
        return ResponseEntity.ok().build();
    }

    @PostMapping("/{id}/notifications/mark-all-read")
    public ResponseEntity<Void> markAllRead(@PathVariable Long id) {
        notificationService.markAllRead(id);
        return ResponseEntity.ok().build();
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
        notificationGeneratorService.createUserCreatedNotification(created.getEmail());
        rhDashboardService.logJournalAction(
            "CREATION_UTILISATEUR",
            authentication != null ? authentication.getName() : "system",
            "Creation du collaborateur " + created.getNom() + " (" + created.getEmail() + ")"
        );
        return ResponseEntity.status(HttpStatus.CREATED).body(created);
    }

    @PutMapping("/{id}")
    public ResponseEntity<CollaborateurResponse> update(
            @PathVariable Long id,
            @Valid @RequestBody CollaborateurRequest request,
            Authentication authentication) {
        CollaborateurResponse updated = service.update(id, request);
        notificationGeneratorService.createUserUpdatedNotification(updated.getEmail());
        rhDashboardService.logJournalAction(
            "MODIFICATION_PROFIL",
            authentication != null ? authentication.getName() : "system",
            "Mise a jour du profil collaborateur " + updated.getNom()
        );
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
    public ResponseEntity<CollaborateurResponse> toggleDisponibilite(@PathVariable Long id, Authentication authentication) {
        CollaborateurResponse updated = service.toggleDisponibilite(id);
        rhDashboardService.logJournalAction(
            "CHANGEMENT_DISPONIBILITE",
            authentication != null ? authentication.getName() : "system",
            "Disponibilite de " + updated.getNom() + " -> " + (updated.isDisponible() ? "Disponible" : "Indisponible")
        );
        return ResponseEntity.ok(updated);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id, Authentication authentication) {
        CollaborateurResponse collab = service.getById(id);
        service.delete(id);
        notificationGeneratorService.createUserDeletedNotification(collab.getEmail());
        auditLogService.log(authentication.getName(), "ADMIN", "DELETE_USER", "Suppression du collaborateur " + collab.getNom(), httpRequest.getRemoteAddr(), "SUCCESS", null, collab.getEmail());
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/{id}/renvoyer-verification")
    public ResponseEntity<MessageResponse> renvoyerVerificationEmail(
            @PathVariable Long id,
            Authentication authentication) {
        MessageResponse response = service.renvoyerVerificationEmail(id);
        auditLogService.log(
            authentication != null ? authentication.getName() : "system",
            "ADMIN",
            "RESEND_VERIFICATION",
            "Renvoi email de vérification pour collaborateur id=" + id,
            httpRequest.getRemoteAddr(),
            "SUCCESS",
            null,
            null
        );
        return ResponseEntity.ok(response);
    }
}
