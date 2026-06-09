package com.smartassign.pfe.service;

import java.util.List;

import com.smartassign.pfe.dto.RhDashboardDto;

public interface RhDashboardService {

    List<RhDashboardDto.JalonItem> getJalons(Long userId);

    RhDashboardDto.JalonItem createJalon(Long userId, String titre, String description, String statut);

    List<RhDashboardDto.ActiviteItem> getActivites(Long userId);

    List<RhDashboardDto.JournalItem> getJournal();

    List<RhDashboardDto.DisponibiliteItem> getDisponibilites();

    void logJournalAction(String action, String utilisateur, String details);

    void generateTestData();
}