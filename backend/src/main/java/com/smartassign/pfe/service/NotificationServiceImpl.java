package com.smartassign.pfe.service;

import com.smartassign.pfe.model.Notification;
import lombok.RequiredArgsConstructor;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class NotificationServiceImpl implements NotificationService {

    private final SimpMessagingTemplate messagingTemplate;

    public void envoyerNotification(Notification notification) {
        messagingTemplate.convertAndSend("/topic/notifications", notification);
    }

    public void notifierAffectation(String collaborateurNom, String projetNom, double score) {
        envoyerNotification(Notification.creer(
            "AFFECTATION",
            "Nouvelle affectation",
            collaborateurNom + " affecté au projet " + projetNom + " avec un score de " + Math.round(score) + "%",
            score >= 75 ? "INFO" : score >= 50 ? "WARNING" : "DANGER"
        ));
    }
}