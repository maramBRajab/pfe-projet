package com.smartassign.pfe.service;

import java.util.List;

import com.smartassign.pfe.dto.CompetenceResponse;

public interface CompetenceService {

    List<CompetenceResponse> getAll();

    CompetenceResponse getById(Long id);

    CompetenceResponse create(String nom);

    void delete(Long id);
}
