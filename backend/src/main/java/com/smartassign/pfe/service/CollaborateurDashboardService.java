package com.smartassign.pfe.service;

import com.smartassign.pfe.dto.CollaborateurDashboardDto;

public interface CollaborateurDashboardService {

    CollaborateurDashboardDto.Response getDashboard(Long requestedCollaborateurId, String authenticatedEmail);
}