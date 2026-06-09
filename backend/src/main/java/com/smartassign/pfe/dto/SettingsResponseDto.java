package com.smartassign.pfe.dto;

import lombok.*;

import java.time.LocalDateTime;

/**
 * Réponse renvoyée après PUT /api/admin/settings et POST /api/admin/settings/reset.
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class SettingsResponseDto {

    private String message;
    private LocalDateTime updatedAt;
    private SettingsDto settings;
}
