package com.smartassign.pfe.controller;

import com.smartassign.pfe.dto.SettingsDto;
import com.smartassign.pfe.dto.SettingsResponseDto;
import com.smartassign.pfe.service.AuditLogService;
import com.smartassign.pfe.service.SettingsService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/admin/settings")
@RequiredArgsConstructor
public class SettingsController {

    private final SettingsService settingsService;
    private final AuditLogService auditLogService;
    private final HttpServletRequest httpRequest;

    /**
     * GET /api/admin/settings
     * Retourne la configuration actuelle depuis la base de données.
     */
    @GetMapping
    public ResponseEntity<SettingsDto> getSettings(Authentication authentication) {
        return ResponseEntity.ok(settingsService.getSettings());
    }

    /**
     * PUT /api/admin/settings
     * Persiste la configuration modifiée.
     */
    @PutMapping
    public ResponseEntity<SettingsResponseDto> updateSettings(
            @Valid @RequestBody SettingsDto request,
            Authentication authentication) {

        String adminEmail = (authentication != null) ? authentication.getName() : "unknown";
        SettingsResponseDto response = settingsService.updateSettings(request, adminEmail);

        // Construire un résumé des champs modifiés pour l'audit
        String details = buildAuditDetails(request);

        auditLogService.log(
                adminEmail,
                "ADMIN",
                "PARAMETRES",
                "Modification des paramètres système",
                httpRequest.getRemoteAddr(),
                "SUCCESS",
                details,
                null
        );

        return ResponseEntity.ok(response);
    }

    /**
     * POST /api/admin/settings/reset
     * Remet les valeurs par défaut définies en base.
     */
    @PostMapping("/reset")
    public ResponseEntity<SettingsResponseDto> resetSettings(Authentication authentication) {

        String adminEmail = authentication != null ? authentication.getName() : "unknown";
        SettingsResponseDto response = settingsService.resetSettings(adminEmail);

        auditLogService.log(
                adminEmail,
                "ADMIN",
                "PARAMETRES",
                "Réinitialisation des paramètres système aux valeurs par défaut",
                httpRequest.getRemoteAddr(),
                "SUCCESS",
                "reset=true",
                null
        );

        return ResponseEntity.ok(response);
    }

    // ── Helpers ───────────────────────────────────────────────

    private String buildAuditDetails(SettingsDto dto) {
        StringBuilder sb = new StringBuilder();
        if (dto.getAffectations() != null) {
            sb.append("seuilCompatibilite=").append(dto.getAffectations().getSeuilCompatibilite()).append("; ");
            sb.append("maxProfilsRecommandes=").append(dto.getAffectations().getMaxProfilsRecommandes()).append("; ");
            sb.append("matchingAutomatique=").append(dto.getAffectations().getMatchingAutomatique()).append("; ");
        }
        if (dto.getPlateforme() != null) {
            sb.append("nomPlateforme=").append(dto.getPlateforme().getNomPlateforme()).append("; ");
            sb.append("modeMaintenance=").append(dto.getPlateforme().getModeMaintenance());
        }
        return sb.toString();
    }
}
