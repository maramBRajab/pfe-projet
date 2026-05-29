package com.smartassign.pfe.controller;

import java.util.List;
import java.util.Map;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import com.smartassign.pfe.dto.CollaborateurRequest;
import com.smartassign.pfe.dto.CollaborateurResponse;
import com.smartassign.pfe.service.CollaborateurService;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;

@RestController
@RequestMapping({ "/api/collaborateurs", "/api/admin/collaborateurs" })
@RequiredArgsConstructor
public class CollaborateurController {

    private final CollaborateurService service;

    @GetMapping
    public ResponseEntity<List<CollaborateurResponse>> getAll() {
        return ResponseEntity.ok(service.getAll());
    }

    @GetMapping("/{id}")
    public ResponseEntity<CollaborateurResponse> getById(@PathVariable Long id) {
        return ResponseEntity.ok(service.getById(id));
    }

    @GetMapping("/search/by-email")
    public ResponseEntity<CollaborateurResponse> getByEmail(@RequestParam String email) {
        return ResponseEntity.ok(service.getByEmail(email));
    }

    @GetMapping("/disponibles")
    public ResponseEntity<List<CollaborateurResponse>> getDisponibles() {
        return ResponseEntity.ok(service.getDisponibles());
    }

    @PostMapping
    public ResponseEntity<CollaborateurResponse> create(
            @Valid @RequestBody CollaborateurRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(service.create(request));
    }

    @PutMapping("/{id}")
    public ResponseEntity<CollaborateurResponse> update(
            @PathVariable Long id,
            @Valid @RequestBody CollaborateurRequest request) {
        return ResponseEntity.ok(service.update(id, request));
    }

    @PatchMapping("/{id}/role")
    public ResponseEntity<CollaborateurResponse> updateRole(
            @PathVariable Long id,
            @RequestBody Map<String, String> payload) {
        return ResponseEntity.ok(service.updateRole(id, payload.get("role")));
    }

    @PatchMapping("/{id}/disponibilite")
    public ResponseEntity<CollaborateurResponse> toggleDisponibilite(@PathVariable Long id) {
        return ResponseEntity.ok(service.toggleDisponibilite(id));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        service.delete(id);
        return ResponseEntity.noContent().build();
    }
}