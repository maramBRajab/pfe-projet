package com.smartassign.pfe.service;

import java.util.Map;

import com.smartassign.pfe.dto.AdminNotificationsResponseDto;

public interface AdminNotificationService {

    AdminNotificationsResponseDto getAll();

    long getUnreadCount();

    void markAsRead(Long id);

    void markAllRead();

    void delete(Long id);

    Map<String, String> okMessage(String message);
}
