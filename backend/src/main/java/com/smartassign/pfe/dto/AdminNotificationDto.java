package com.smartassign.pfe.dto;

import java.time.LocalDateTime;

import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class AdminNotificationDto {
    private Long id;
    private String type;
    private String titre;
    private String description;
    private boolean isRead;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
    private Long projetId;
    private String projetNom;
}
