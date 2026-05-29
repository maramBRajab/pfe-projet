package com.smartassign.pfe.controller;

import com.smartassign.pfe.model.AuditLog;
import com.smartassign.pfe.repository.AuditLogRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/audit-logs")
@RequiredArgsConstructor
public class AuditLogController {
    private final AuditLogRepository auditLogRepository;

    @GetMapping
    public ResponseEntity<List<AuditLog>> getAllLogs() {
        return ResponseEntity.ok(auditLogRepository.findAll());
    }
}
