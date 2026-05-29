package com.smartassign.pfe.service;

import java.util.List;

import com.smartassign.pfe.dto.CollaborateurRequest;
import com.smartassign.pfe.dto.CollaborateurResponse;
import com.smartassign.pfe.entity.Collaborateur;

public interface CollaborateurService {

    List<CollaborateurResponse> getAll();

    CollaborateurResponse getById(Long id);

    CollaborateurResponse getByEmail(String email);

    CollaborateurResponse create(CollaborateurRequest request);

    CollaborateurResponse update(Long id, CollaborateurRequest request);

    CollaborateurResponse updateRole(Long id, String role);

    CollaborateurResponse toggleDisponibilite(Long id);

    void delete(Long id);

    List<CollaborateurResponse> getDisponibles();

    CollaborateurResponse toResponse(Collaborateur collaborateur);

    CollaborateurResponse toResponse(Collaborateur collaborateur, String generatedPassword);
}
