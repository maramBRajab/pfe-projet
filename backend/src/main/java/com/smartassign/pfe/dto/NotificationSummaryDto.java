package com.smartassign.pfe.dto;

import java.util.List;

public record NotificationSummaryDto(
    int totalAlertes,
    int informations,
    int vigilances,
    int critiques,
    List<NotificationDto> notifications
) {
}
