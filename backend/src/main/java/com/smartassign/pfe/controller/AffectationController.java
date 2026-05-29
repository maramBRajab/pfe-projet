package com.smartassign.pfe.controller;

import java.util.List;
import java.util.Map;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import com.smartassign.pfe.dto.AffectationCreateRequest;
import com.smartassign.pfe.dto.AffectationResponse;
import com.smartassign.pfe.service.AffectationService;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;

@RestController
@RequestMapping("/api/affectations")
@RequiredArgsConstructor
public class AffectationController {

    private final AffectationService service;

    // ⭐ Lancer l'algorithme d'affectation
    @PostMapping("/lancer/{projetId}")
    public ResponseEntity<List<AffectationResponse>> lancer(
            @PathVariable Long projetId) {
        return ResponseEntity.ok(service.lancerAffectation(projetId));
    }

    // ⭐ Créer une affectation unitaire (depuis le bouton "Affecter")
    @PostMapping
    public ResponseEntity<AffectationResponse> create(
            @Valid @RequestBody AffectationCreateRequest request) {
        return ResponseEntity
                .status(org.springframework.http.HttpStatus.CREATED)
                .body(service.create(request));
    }

    @GetMapping
    public ResponseEntity<List<AffectationResponse>> getAll() {
        return ResponseEntity.ok(service.getAll());
    }

    @GetMapping("/projet/{projetId}")
    public ResponseEntity<List<AffectationResponse>> getByProjet(
            @PathVariable Long projetId) {
        return ResponseEntity.ok(service.getByProjet(projetId));
    }

    @GetMapping("/collaborateur/{collaborateurId}")
    public ResponseEntity<List<AffectationResponse>> getByCollaborateur(
            @PathVariable Long collaborateurId) {
        return ResponseEntity.ok(service.getByCollaborateur(collaborateurId));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        service.delete(id);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/{id}")
    public ResponseEntity<AffectationResponse> getById(@PathVariable Long id) {
        return ResponseEntity.ok(service.getById(id));
    }

    @PutMapping("/{id}")
    public ResponseEntity<AffectationResponse> update(
            @PathVariable Long id,
            @RequestBody Map<String, Long> body) {
        return ResponseEntity.ok(service.update(id, body.get("collaborateurId")));
    }
}