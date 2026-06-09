package com.smartassign.pfe.dto;

import java.time.LocalDateTime;

public record NotificationDto(
    Long id,
    String type,
    String titre,
    String description,
    LocalDateTime date,
    String notificationKey,
    boolean lu
) {
}
