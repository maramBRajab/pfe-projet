package com.smartassign.pfe.controller;

import java.util.List;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.smartassign.pfe.dto.RhDashboardDto;
import com.smartassign.pfe.entity.Utilisateur;
import com.smartassign.pfe.repository.UtilisateurRepository;
import com.smartassign.pfe.service.AuditLogService;
import com.smartassign.pfe.service.RhDashboardService;

import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;

@RestController
@RequestMapping
@RequiredArgsConstructor
public class RhDashboardController {

    private final RhDashboardService rhDashboardService;
    private final UtilisateurRepository utilisateurRepository;
    private final AuditLogService auditLogService;
    private final HttpServletRequest httpRequest;

    @GetMapping({"/api/jalons", "/jalons"})
    public ResponseEntity<List<RhDashboardDto.JalonItem>> getJalons(
        @RequestParam(value = "userId", required = false) Long userId,
        Authentication authentication
    ) {
        return ResponseEntity.ok(rhDashboardService.getJalons(resolveUserId(userId, authentication)));
    }

    @PostMapping({"/api/jalons", "/jalons"})
    public ResponseEntity<RhDashboardDto.JalonItem> createJalon(
        @RequestParam("titre") String titre,
        @RequestParam(value = "description", required = false, defaultValue = "") String description,
        @RequestParam(value = "statut", required = false, defaultValue = "A_PLANIFIER") String statut,
        Authentication authentication
    ) {
        Long resolvedUserId = resolveUserId(null, authentication);
        RhDashboardDto.JalonItem created = rhDashboardService.createJalon(resolvedUserId, titre, description, statut);

        rhDashboardService.logJournalAction(
            "AJOUT_TACHE",
            authentication != null ? authentication.getName() : "system",
            "Ajout d'un jalon/tache : " + titre
        );

        return ResponseEntity.status(HttpStatus.CREATED).body(created);
    }

    @GetMapping({"/api/activites", "/activites"})
    public ResponseEntity<List<RhDashboardDto.ActiviteItem>> getActivites(
        @RequestParam(value = "userId", required = false) Long userId,
        Authentication authentication
    ) {
        return ResponseEntity.ok(rhDashboardService.getActivites(resolveUserId(userId, authentication)));
    }

    @GetMapping({"/api/journal", "/journal"})
    public ResponseEntity<List<RhDashboardDto.JournalItem>> getJournal() {
        return ResponseEntity.ok(rhDashboardService.getJournal());
    }

    @GetMapping({"/api/utilisateurs/disponibilite", "/utilisateurs/disponibilite"})
    public ResponseEntity<List<RhDashboardDto.DisponibiliteItem>> getDisponibilites() {
        return ResponseEntity.ok(rhDashboardService.getDisponibilites());
    }

    @PostMapping({"/api/dashboard-rh/generate-test-data", "/dashboard-rh/generate-test-data"})
    public ResponseEntity<Void> generateTestData(Authentication authentication) {
        rhDashboardService.generateTestData();
        auditLogService.log(
            authentication != null ? authentication.getName() : "system",
            "ADMIN",
            "GENERATE_TEST_DATA",
            "Generation des donnees de test dashboard RH",
            httpRequest.getRemoteAddr(),
            "SUCCESS",
            null,
            "dashboard-rh"
        );
        return ResponseEntity.status(HttpStatus.CREATED).build();
    }

    private Long resolveUserId(Long requestedUserId, Authentication authentication) {
        if (requestedUserId != null) {
            return requestedUserId;
        }

        if (authentication == null || authentication.getName() == null) {
            return null;
        }

        String email = authentication.getName().trim();
        Utilisateur utilisateur = utilisateurRepository.findByEmailIgnoreCase(email).orElse(null);
        return utilisateur != null ? utilisateur.getId() : null;
    }
}
