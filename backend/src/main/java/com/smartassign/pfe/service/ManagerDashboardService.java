package com.smartassign.pfe.service;

import com.smartassign.pfe.dto.ManagerDashboardDto.AlertsResponse;
import com.smartassign.pfe.dto.ManagerDashboardDto.Stats;

public interface ManagerDashboardService {

    Stats getStats(String managerEmail);

    AlertsResponse getPriorityAlerts(String managerEmail);
}
