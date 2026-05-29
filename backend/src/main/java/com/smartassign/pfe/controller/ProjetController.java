package com.smartassign.pfe.controller;

import java.util.List;
import java.util.Map;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import com.smartassign.pfe.dto.ProjetRequest;
import com.smartassign.pfe.dto.ProjetResponse;
import com.smartassign.pfe.service.ProjetService;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;

@RestController
@RequestMapping({ "/api/projets", "/api/admin/projets" })
@RequiredArgsConstructor
public class ProjetController {

    private final ProjetService service;

    @GetMapping
    public ResponseEntity<List<ProjetResponse>> getAll() {
        return ResponseEntity.ok(service.getAll());
    }

    @GetMapping("/{id}")
    public ResponseEntity<ProjetResponse> getById(@PathVariable Long id) {
        return ResponseEntity.ok(service.getById(id));
    }

    @GetMapping("/statut/{statut}")
    public ResponseEntity<List<ProjetResponse>> getByStatut(@PathVariable String statut) {
        return ResponseEntity.ok(service.getByStatut(statut));
    }

    @PostMapping
    public ResponseEntity<ProjetResponse> create(
            @Valid @RequestBody ProjetRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(service.create(request));
    }

    @PutMapping("/{id}")
    public ResponseEntity<ProjetResponse> update(
            @PathVariable Long id,
            @Valid @RequestBody ProjetRequest request) {
        return ResponseEntity.ok(service.update(id, request));
    }

    @PatchMapping("/{id}/statut")
    public ResponseEntity<ProjetResponse> updateStatut(
            @PathVariable Long id,
            @RequestBody Map<String, String> payload) {
        return ResponseEntity.ok(service.updateStatut(id, payload.get("statut")));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        service.delete(id);
        return ResponseEntity.noContent().build();
    }
}