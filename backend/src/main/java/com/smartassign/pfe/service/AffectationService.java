package com.smartassign.pfe.service;

import java.util.List;

import com.smartassign.pfe.dto.AffectationCreateRequest;
import com.smartassign.pfe.dto.AffectationResponse;

public interface AffectationService {

    List<AffectationResponse> lancerAffectation(Long projetId);

    AffectationResponse create(AffectationCreateRequest request);

    List<AffectationResponse> getAll();

    List<AffectationResponse> getByProjet(Long projetId);

    List<AffectationResponse> getByCollaborateur(Long collaborateurId);

    AffectationResponse getById(Long id);

    AffectationResponse update(Long id, Long collaborateurId);

    void delete(Long id);
}
