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
}
