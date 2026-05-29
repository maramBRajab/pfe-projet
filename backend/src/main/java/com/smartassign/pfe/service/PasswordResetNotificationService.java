package com.smartassign.pfe.service;

import java.time.LocalDateTime;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.MailException;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.stereotype.Service;

import com.smartassign.pfe.exception.BusinessException;

@Service
public class PasswordResetNotificationService {

    private static final Logger LOGGER = LoggerFactory.getLogger(PasswordResetNotificationService.class);

    private final JavaMailSender mailSender;

    @Value("${spring.mail.host:}")
    private String mailHost;

    @Value("${spring.mail.username:no-reply@smartassign.local}")
    private String senderEmail;

    public PasswordResetNotificationService(JavaMailSender mailSender) {
        this.mailSender = mailSender;
    }

    public void sendResetLink(String recipientEmail, String displayName, String resetLink, LocalDateTime expiresAt) {
        if (mailHost == null || mailHost.isBlank()) {
            LOGGER.error("SMTP non configure. Impossible d'envoyer le lien de reinitialisation pour {}.", recipientEmail);
            throw new BusinessException("Le service email n'est pas configure. Renseignez spring.mail.host avant de demander une reinitialisation de mot de passe.");
        }

        SimpleMailMessage message = new SimpleMailMessage();
        message.setTo(recipientEmail);
        message.setFrom(senderEmail);
        message.setSubject("SmartAssign | Reinitialisation du mot de passe");
        message.setText(buildEmailBody(displayName, resetLink, expiresAt));

        try {
            mailSender.send(message);
        } catch (MailException exception) {
            LOGGER.error("Echec d'envoi de l'email de reinitialisation vers {} via l'hote SMTP {}.", recipientEmail, mailHost, exception);
            throw new BusinessException("Impossible d'envoyer l'email de reinitialisation pour le moment. Verifiez la configuration SMTP.");
        }
    }

    private String buildEmailBody(String displayName, String resetLink, LocalDateTime expiresAt) {
        String resolvedName = (displayName == null || displayName.isBlank()) ? "utilisateur" : displayName;

        return "Bonjour " + resolvedName + ",\n\n"
                + "Vous avez demande la reinitialisation de votre mot de passe SmartAssign.\n"
                + "Cliquez sur le lien suivant pour definir un nouveau mot de passe :\n\n"
                + resetLink + "\n\n"
                + "Ce lien expirera le " + expiresAt + ".\n"
                + "Si vous n'etes pas a l'origine de cette demande, ignorez simplement ce message.\n\n"
                + "Equipe SmartAssign";
    }
}