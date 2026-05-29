package com.smartassign.pfe.service;

import com.smartassign.pfe.model.AuditLog;
import com.smartassign.pfe.repository.AuditLogRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;

@Service
@RequiredArgsConstructor
public class AuditLogService {
    private final AuditLogRepository auditLogRepository;

    public void log(String user, String userRole, String action,
                   String description, String ip, String status,
                   String details, String target) {
        AuditLog log = new AuditLog();
        log.setDate(LocalDateTime.now());
        log.setUser(user);
        log.setUserRole(userRole);
        log.setAction(action);
        log.setDescription(description);
        log.setIp(ip);
        log.setStatus(status);
        log.setDetails(details);
        log.setTarget(target);
        auditLogRepository.save(log);
    }
}
