package com.smartassign.pfe.service;

import com.smartassign.pfe.dto.NotificationSummaryDto;

public interface CollaborateurNotificationService {

    NotificationSummaryDto getNotifications(Long requestedCollaborateurId);

    void dismissNotification(Long requestedCollaborateurId, String notificationKey);

    void markAllRead(Long requestedCollaborateurId);
}
