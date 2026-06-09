package com.smartassign.pfe.controller;

import java.util.Map;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.smartassign.pfe.dto.AdminNotificationsResponseDto;
import com.smartassign.pfe.service.AdminNotificationService;

@RestController
@RequestMapping("/api/admin/notifications")
public class AdminNotificationsController {

    private final AdminNotificationService adminNotificationService;

    public AdminNotificationsController(AdminNotificationService adminNotificationService) {
        this.adminNotificationService = adminNotificationService;
    }

    @GetMapping
    public ResponseEntity<AdminNotificationsResponseDto> getAll(Authentication authentication) {
        if (!isAdmin(authentication)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
        }

        return ResponseEntity.ok(adminNotificationService.getAll());
    }

    @GetMapping("/unread-count")
    public ResponseEntity<Map<String, Long>> getUnreadCount(Authentication authentication) {
        if (!isAdmin(authentication)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Map.of("count", 0L));
        }

        return ResponseEntity.ok(Map.of("count", adminNotificationService.getUnreadCount()));
    }

    @PutMapping("/{id}/read")
    public ResponseEntity<Map<String, String>> markAsRead(@PathVariable Long id, Authentication authentication) {
        if (!isAdmin(authentication)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(adminNotificationService.okMessage("Acces refuse"));
        }

        adminNotificationService.markAsRead(id);
        return ResponseEntity.ok(adminNotificationService.okMessage("Notification marquee comme lue"));
    }

    @PutMapping("/mark-all-read")
    public ResponseEntity<Map<String, String>> markAllRead(Authentication authentication) {
        if (!isAdmin(authentication)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(adminNotificationService.okMessage("Acces refuse"));
        }

        adminNotificationService.markAllRead();
        return ResponseEntity.ok(adminNotificationService.okMessage("Toutes les notifications marquees comme lues"));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Map<String, String>> deleteNotification(@PathVariable Long id, Authentication authentication) {
        if (!isAdmin(authentication)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(adminNotificationService.okMessage("Acces refuse"));
        }

        adminNotificationService.delete(id);
        return ResponseEntity.ok(adminNotificationService.okMessage("Notification supprimee"));
    }

    private boolean isAdmin(Authentication authentication) {
        if (authentication == null || authentication.getAuthorities() == null) {
            return false;
        }

        for (GrantedAuthority authority : authentication.getAuthorities()) {
            String value = authority.getAuthority();
            if ("ADMIN".equalsIgnoreCase(value) || "ROLE_ADMIN".equalsIgnoreCase(value)) {
                return true;
            }
        }

        return false;
    }
}
