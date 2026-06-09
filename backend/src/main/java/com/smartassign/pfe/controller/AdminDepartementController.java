package com.smartassign.pfe.controller;

import java.util.List;
import java.util.Map;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.smartassign.pfe.dto.AdminDepartementDto.CollaborateurDepartementRow;
import com.smartassign.pfe.dto.AdminDepartementDto.UpdateDepartementRequest;
import com.smartassign.pfe.service.AdminDepartementService;

import lombok.RequiredArgsConstructor;

@RestController
@RequestMapping("/api/admin/departements")
@RequiredArgsConstructor
public class AdminDepartementController {

    private final AdminDepartementService service;

    @GetMapping("/collaborateurs")
    public ResponseEntity<List<CollaborateurDepartementRow>> listCollaborateursDepartements() {
        return ResponseEntity.ok(service.listCollaborateursDepartements());
    }

    @PutMapping("/collaborateurs")
    public ResponseEntity<Map<String, Integer>> updateCollaborateursDepartements(
        @RequestBody List<UpdateDepartementRequest> updates
    ) {
        int updated = service.updateCollaborateursDepartements(updates);
        return ResponseEntity.ok(Map.of("updated", updated));
    }
}
