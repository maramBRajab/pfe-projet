package com.smartassign.pfe.controller;

import java.util.List;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.smartassign.pfe.dto.AdminDashboardDto.Activite;
import com.smartassign.pfe.dto.AdminDashboardDto.Alerte;
import com.smartassign.pfe.dto.AdminDashboardDto.DashboardInsights;
import com.smartassign.pfe.dto.AdminDashboardDto.DashboardStats;
import com.smartassign.pfe.dto.AdminDashboardDto.EvolutionMois;
import com.smartassign.pfe.dto.AdminDashboardDto.RepartitionRoles;
import com.smartassign.pfe.dto.AdminDashboardDto.SearchResult;
import com.smartassign.pfe.service.AdminDashboardService;

import lombok.RequiredArgsConstructor;

@RestController
@RequestMapping("/api/dashboard/admin")
@RequiredArgsConstructor
public class AdminDashboardController {

    private final AdminDashboardService service;

    @GetMapping("/stats")
    public ResponseEntity<DashboardStats> getStats() {
        return ResponseEntity.ok(service.getStats());
    }

    @GetMapping("/evolution-projets")
    public ResponseEntity<List<EvolutionMois>> getEvolutionProjets() {
        return ResponseEntity.ok(service.getEvolutionProjets());
    }

    @GetMapping("/repartition-roles")
    public ResponseEntity<RepartitionRoles> getRepartitionRoles() {
        return ResponseEntity.ok(service.getRepartitionRoles());
    }

    @GetMapping("/alertes")
    public ResponseEntity<List<Alerte>> getAlertes() {
        return ResponseEntity.ok(service.getAlertes());
    }

    @GetMapping("/activite-recente")
    public ResponseEntity<List<Activite>> getActiviteRecente() {
        return ResponseEntity.ok(service.getActiviteRecente());
    }

    @GetMapping("/insights")
    public ResponseEntity<DashboardInsights> getInsights() {
        return ResponseEntity.ok(service.getInsights());
    }

    @GetMapping("/search")
    public ResponseEntity<List<SearchResult>> search(@RequestParam("query") String query) {
        return ResponseEntity.ok(service.search(query));
    }
}