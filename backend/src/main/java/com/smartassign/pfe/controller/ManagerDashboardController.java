package com.smartassign.pfe.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.smartassign.pfe.dto.ManagerDashboardDto.AlertsResponse;
import com.smartassign.pfe.dto.ManagerDashboardDto.Stats;
import com.smartassign.pfe.service.ManagerDashboardService;

import lombok.RequiredArgsConstructor;

@RestController
@RequestMapping("/api/dashboard/manager")
@RequiredArgsConstructor
public class ManagerDashboardController {

    private final ManagerDashboardService service;

    @GetMapping("/stats")
    public ResponseEntity<Stats> getStats(Authentication auth) {
        return ResponseEntity.ok(service.getStats(auth.getName()));
    }

    @GetMapping("/alertes-prioritaires")
    public ResponseEntity<AlertsResponse> getPriorityAlerts(Authentication auth) {
        return ResponseEntity.ok(service.getPriorityAlerts(auth.getName()));
    }
}
