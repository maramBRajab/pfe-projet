package com.smartassign.pfe.service;

import java.util.List;

import com.smartassign.pfe.dto.CollaborateurMesProjetsDto;

public interface CollaborateurMesProjetsService {

    List<CollaborateurMesProjetsDto.ProjetItem> getMesProjets(Long requestedCollaborateurId, String authenticatedEmail);
}