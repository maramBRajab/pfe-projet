package com.smartassign.pfe.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class UserPreferencesRequest {

    @NotNull
    private Boolean notificationsEnabled;

    @NotNull
    private Boolean urgentAlerts;

    @NotNull
    private Boolean projectUpdates;

    @NotBlank
    private String language;

    @NotBlank
    private String displayDensity;

    @NotBlank
    private String theme;
}