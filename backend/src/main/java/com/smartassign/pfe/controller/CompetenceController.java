package com.smartassign.pfe.controller;

import java.util.List;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import com.smartassign.pfe.dto.CompetenceResponse;
import com.smartassign.pfe.service.CompetenceService;

import lombok.RequiredArgsConstructor;

@RestController
@RequestMapping("/api/competences")
@RequiredArgsConstructor
public class CompetenceController {

    private final CompetenceService service;

    @GetMapping
    public ResponseEntity<List<CompetenceResponse>> getAll() {
        return ResponseEntity.ok(service.getAll());
    }

    @GetMapping("/{id}")
    public ResponseEntity<CompetenceResponse> getById(@PathVariable Long id) {
        return ResponseEntity.ok(service.getById(id));
    }

    @PostMapping
    public ResponseEntity<CompetenceResponse> create(@RequestParam String nom) {
        return ResponseEntity.status(HttpStatus.CREATED).body(service.create(nom));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        service.delete(id);
        return ResponseEntity.noContent().build();
    }
}