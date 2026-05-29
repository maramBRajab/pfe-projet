package com.smartassign.pfe.service;

import java.util.List;

import com.smartassign.pfe.dto.ProjetRequest;
import com.smartassign.pfe.dto.ProjetResponse;
import com.smartassign.pfe.entity.Projet;

public interface ProjetService {

    List<ProjetResponse> getAll();

    ProjetResponse getById(Long id);

    ProjetResponse create(ProjetRequest request);

    ProjetResponse update(Long id, ProjetRequest request);

    ProjetResponse updateStatut(Long id, String statut);

    void delete(Long id);

    List<ProjetResponse> getByStatut(String statut);

    ProjetResponse toResponse(Projet projet);
}
