package com.smartassign.pfe.dto;

import java.util.List;

import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class AdminNotificationsResponseDto {

    private List<AdminNotificationDto> notifications;
    private StatsDto stats;

    @Data
    @Builder
    public static class StatsDto {
        private long total;
        private long vigilances;
        private long critiques;
        private long informations;
        private long nonLues;
    }
}
