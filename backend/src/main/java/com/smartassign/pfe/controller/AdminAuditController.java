package com.smartassign.pfe.controller;

import com.smartassign.pfe.model.AuditLog;
import com.smartassign.pfe.repository.AuditLogRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/admin/audit")
public class AdminAuditController {

    @Autowired
    private AuditLogRepository auditLogRepository;

    @GetMapping("/logs")
    public List<AuditLog> getAuditLogs() {
        return auditLogRepository.findAll();
    }
}
