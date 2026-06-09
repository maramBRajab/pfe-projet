package com.smartassign.pfe.service;

import java.util.List;

import com.smartassign.pfe.dto.CollaborateurRequest;
import com.smartassign.pfe.dto.CollaborateurResponse;
import com.smartassign.pfe.dto.MessageResponse;
import com.smartassign.pfe.dto.MesProjetsDto;
import com.smartassign.pfe.entity.Collaborateur;

public interface CollaborateurService {

    List<CollaborateurResponse> getAll();

    List<CollaborateurResponse> getAllUsers();

    CollaborateurResponse getById(Long id);

    CollaborateurResponse getByEmail(String email);

    CollaborateurResponse create(CollaborateurRequest request);

    CollaborateurResponse update(Long id, CollaborateurRequest request);

    CollaborateurResponse updateRole(Long id, String role);

    CollaborateurResponse updateStatutCompte(Long id, String statut);

    CollaborateurResponse toggleDisponibilite(Long id);

    void delete(Long id);

    List<CollaborateurResponse> getDisponibles();

    MesProjetsDto getMesProjets(Long requestedCollaborateurId, String authenticatedEmail);

    CollaborateurResponse toResponse(Collaborateur collaborateur);

    CollaborateurResponse toResponse(Collaborateur collaborateur, String generatedPassword);

    MessageResponse renvoyerVerificationEmail(Long id);
}
