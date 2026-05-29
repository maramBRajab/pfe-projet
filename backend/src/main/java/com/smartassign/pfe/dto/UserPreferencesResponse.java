package com.smartassign.pfe.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class UserPreferencesResponse {

    private Boolean notificationsEnabled;
    private Boolean urgentAlerts;
    private Boolean projectUpdates;
    private String language;
    private String displayDensity;
    private String theme;
}