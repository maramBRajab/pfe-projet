package com.smartassign.pfe.service;

import java.util.List;

import com.smartassign.pfe.dto.AdminDashboardDto.Activite;
import com.smartassign.pfe.dto.AdminDashboardDto.Alerte;
import com.smartassign.pfe.dto.AdminDashboardDto.DashboardInsights;
import com.smartassign.pfe.dto.AdminDashboardDto.DashboardStats;
import com.smartassign.pfe.dto.AdminDashboardDto.EvolutionMois;
import com.smartassign.pfe.dto.AdminDashboardDto.RepartitionRoles;
import com.smartassign.pfe.dto.AdminDashboardDto.SearchResult;

public interface AdminDashboardService {

    DashboardStats getStats();

    List<EvolutionMois> getEvolutionProjets();

    RepartitionRoles getRepartitionRoles();

    List<Alerte> getAlertes();

    List<Activite> getActiviteRecente();

    DashboardInsights getInsights();
    List<SearchResult> search(String query);
}
