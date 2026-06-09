package com.smartassign.pfe.service;

import java.util.List;
import java.util.Locale;
import java.util.Map;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import com.smartassign.pfe.dto.AdminNotificationDto;
import com.smartassign.pfe.dto.AdminNotificationsResponseDto;
import com.smartassign.pfe.repository.AdminNotificationRepository;

import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
@Transactional
public class AdminNotificationServiceImpl implements AdminNotificationService {

    private final AdminNotificationRepository notificationRepository;
    private final NotificationGeneratorService notificationGeneratorService;

    @Override
    public AdminNotificationsResponseDto getAll() {
        notificationGeneratorService.generateSystemNotifications();

        List<AdminNotificationDto> notifications = notificationRepository.findAllWithProjetNom().stream()
            .map(this::toDto)
            .toList();

        long total = notifications.size();
        long critiques = notifications.stream().filter(n -> isType(n.getType(), "CRITIQUE")).count();
        long vigilances = notifications.stream().filter(n -> isType(n.getType(), "VIGILANCE")).count();
        long informations = notifications.stream().filter(n -> isType(n.getType(), "INFO")).count();
        long nonLues = notifications.stream().filter(n -> !n.isRead()).count();

        return AdminNotificationsResponseDto.builder()
            .notifications(notifications)
            .stats(AdminNotificationsResponseDto.StatsDto.builder()
                .total(total)
                .vigilances(vigilances)
                .critiques(critiques)
                .informations(informations)
                .nonLues(nonLues)
                .build())
            .build();
    }

    @Override
    @Transactional(readOnly = true)
    public long getUnreadCount() {
        return notificationRepository.countUnread();
    }

    @Override
    public void markAsRead(Long id) {
        List<AdminNotificationRepository.NotificationMutationRow> updatedRows = notificationRepository.markAsReadReturning(id);
        if (updatedRows.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Notification introuvable");
        }
    }

    @Override
    public void markAllRead() {
        notificationRepository.markAllRead();
    }

    @Override
    public void delete(Long id) {
        int deleted = notificationRepository.deleteByIdNative(id);
        if (deleted == 0) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Notification introuvable");
        }
    }

    @Override
    public Map<String, String> okMessage(String message) {
        return Map.of("message", message);
    }

    private AdminNotificationDto toDto(AdminNotificationRepository.NotificationRow row) {
        return AdminNotificationDto.builder()
            .id(row.getId())
            .type(row.getType())
            .titre(row.getTitre())
            .description(row.getDescription())
            .isRead(Boolean.TRUE.equals(row.getIsRead()))
            .createdAt(row.getCreatedAt())
            .updatedAt(row.getUpdatedAt())
            .projetId(row.getProjetId())
            .projetNom(row.getProjetNom())
            .build();
    }

    private boolean isType(String actual, String expected) {
        return actual != null && actual.trim().toUpperCase(Locale.ROOT).equals(expected);
    }
}
