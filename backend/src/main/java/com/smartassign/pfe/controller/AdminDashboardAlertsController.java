package com.smartassign.pfe.controller;

import java.util.List;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.smartassign.pfe.dto.AdminDashboardDto.Alerte;
import com.smartassign.pfe.service.AdminDashboardService;

import lombok.RequiredArgsConstructor;

@RestController
@RequestMapping("/api/admin/dashboard")
@RequiredArgsConstructor
public class AdminDashboardAlertsController {

    private final AdminDashboardService service;

    @GetMapping("/alerts")
    public ResponseEntity<List<Alerte>> getAlerts() {
        return ResponseEntity.ok(service.getAlertes());
    }
}