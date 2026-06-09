package com.smartassign.pfe.controller;

import com.smartassign.pfe.model.AuditLog;
import com.smartassign.pfe.repository.AuditLogRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Locale;

@RestController
@RequestMapping("/api/admin/audit")
public class AdminAuditController {

    @Autowired
    private AuditLogRepository auditLogRepository;

    @GetMapping("/logs")
    public ResponseEntity<List<AuditLog>> getAuditLogs(
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String action) {
        List<AuditLog> logs;
        if (status != null && !status.isEmpty()) {
            logs = auditLogRepository.findByStatusOrderByDateDesc(status);
        } else if (action != null && !action.isEmpty()) {
            logs = auditLogRepository.findByActionOrderByDateDesc(action);
        } else {
            logs = auditLogRepository.findAllByOrderByDateDesc();
        }
        return ResponseEntity.ok(logs);
    }

    @GetMapping
    public ResponseEntity<List<TimelineAuditItem>> getRecentAuditForTimeline(
            @RequestParam(defaultValue = "6") int limit,
            @RequestParam(defaultValue = "desc") String sort) {
        List<AuditLog> logs = auditLogRepository.findAllByOrderByDateDesc();
        int safeLimit = Math.max(1, Math.min(limit, 50));

        if ("asc".equalsIgnoreCase(sort)) {
            logs = logs.stream()
                .sorted((a, b) -> {
                    if (a.getDate() == null && b.getDate() == null) return 0;
                    if (a.getDate() == null) return -1;
                    if (b.getDate() == null) return 1;
                    return a.getDate().compareTo(b.getDate());
                })
                .toList();
        }

        List<TimelineAuditItem> items = logs.stream()
            .limit(safeLimit)
            .map(log -> new TimelineAuditItem(
                log.getId(),
                log.getAction(),
                resolveType(log),
                log.getUser(),
                log.getUserRole(),
                log.getIp(),
                log.getDate() == null ? null : log.getDate().toString(),
                log.getDescription(),
                log.getStatus()))
            .toList();

        return ResponseEntity.ok(items);
    }

    private String resolveType(AuditLog log) {
        String action = (log.getAction() == null ? "" : log.getAction().trim().toUpperCase(Locale.FRENCH));

        return switch (action) {
            case "LOGIN", "LOGOUT" -> "CONNEXION";
            case "CREATE_USER", "CREATE_PROJET" -> "CRÉATION";
            case "UPDATE_USER", "UPDATE_PROJET", "ASSIGN", "ROLE_CHANGE" -> "MODIFICATION";
            case "DELETE_USER", "DELETE_PROJET", "UNASSIGN" -> "SUPPRESSION";
            case "LOGIN_FAILED" -> "ERREUR";
            case "PARAMETRES" -> "PARAMÈTRES";
            default -> {
                String status = (log.getStatus() == null ? "" : log.getStatus().trim().toUpperCase(Locale.FRENCH));
                if ("FAILED".equals(status)) {
                    yield "ERREUR";
                }
                yield "CONNEXION";
            }
        };
    }

    public record TimelineAuditItem(
        Long id,
        String action,
        String type,
        String userEmail,
        String role,
        String ip,
        String date,
        String detail,
        String status
    ) {}
}
