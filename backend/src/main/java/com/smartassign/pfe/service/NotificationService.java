package com.smartassign.pfe.service;

import com.smartassign.pfe.model.Notification;

public interface NotificationService {

    void envoyerNotification(Notification notification);

    void notifierAffectation(String collaborateurNom, String projetNom, double score);
}
