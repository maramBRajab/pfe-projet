package com.smartassign.pfe.repository.projection;

import java.time.LocalDateTime;

public interface DisponibiliteNotificationProjection {
    Long getId();
    LocalDateTime getDateDebut();
    String getType();
    String getLibelle();
}
