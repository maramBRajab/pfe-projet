package com.smartassign.pfe.service;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.MailAuthenticationException;
import org.springframework.mail.MailException;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import com.smartassign.pfe.config.AppMailProperties;
import com.smartassign.pfe.exception.BusinessException;

@Service
public class PasswordResetNotificationService {

    private static final Logger LOGGER = LoggerFactory.getLogger(PasswordResetNotificationService.class);
    private static final DateTimeFormatter EXPIRY_FORMAT = DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm");

    private final JavaMailSender mailSender;
    private final AppMailProperties appMailProperties;

    @Value("${spring.mail.host:}")
    private String mailHost;

    @Value("${spring.mail.username:}")
    private String mailUsername;

    @Value("${spring.mail.password:}")
    private String mailPassword;

    public PasswordResetNotificationService(JavaMailSender mailSender, AppMailProperties appMailProperties) {
        this.mailSender = mailSender;
        this.appMailProperties = appMailProperties;
    }

    public void sendResetLink(String recipientEmail, String displayName, String resetLink, LocalDateTime expiresAt) {
        sendResetPasswordEmail(recipientEmail, displayName, resetLink, expiresAt);
    }

    public void sendResetPasswordEmail(String recipientEmail, String displayName, String resetLink, LocalDateTime expiresAt) {
        if (!appMailProperties.isEnabled()) {
            logResetLinkForDevelopment(recipientEmail, resetLink, expiresAt);
            return;
        }

        if (!isSmtpConfigured()) {
            if (appMailProperties.isDevLogResetLink()) {
                logResetLinkForDevelopment(recipientEmail, resetLink, expiresAt);
                return;
            }

            LOGGER.error(
                    "SMTP incomplet pour {} — host={}, username renseigne={}, password renseigne={}",
                    recipientEmail,
                    StringUtils.hasText(mailHost),
                    StringUtils.hasText(mailUsername),
                    StringUtils.hasText(mailPassword));

            throw new BusinessException(
                    "Le service email n'est pas configure. "
                            + "Definissez SPRING_MAIL_HOST, SPRING_MAIL_USERNAME et SPRING_MAIL_PASSWORD "
                            + "(mot de passe d'application Gmail), ou activez MAIL_DEV_LOG_RESET_LINK=true en developpement.");
        }

        SimpleMailMessage message = new SimpleMailMessage();
        message.setTo(recipientEmail);
        message.setFrom(appMailProperties.getFrom());
        message.setSubject("SmartAssign | Reinitialisation du mot de passe");
        message.setText(buildEmailBody(displayName, resetLink, expiresAt));

        try {
            LOGGER.info("Envoi de l'email de reinitialisation vers {} via {}", recipientEmail, mailHost.trim());
            mailSender.send(message);
            LOGGER.info("Email de reinitialisation envoye avec succes vers {}", recipientEmail);
        } catch (MailAuthenticationException exception) {
            LOGGER.error(
                    "Authentification SMTP refusee pour {} (hote={}, utilisateur={})",
                    recipientEmail,
                    mailHost,
                    maskEmail(mailUsername),
                    exception);
            throw new BusinessException(
                    "Impossible de s'authentifier sur le serveur email. "
                            + "Verifiez SPRING_MAIL_USERNAME et SPRING_MAIL_PASSWORD (mot de passe d'application Gmail).");
        } catch (MailException exception) {
            LOGGER.error(
                    "Echec d'envoi de l'email de reinitialisation vers {} via l'hote SMTP {}",
                    recipientEmail,
                    mailHost,
                    exception);
            throw new BusinessException(
                    "Impossible d'envoyer l'email de reinitialisation pour le moment. Verifiez la configuration SMTP.");
        }
    }

    private boolean isSmtpConfigured() {
        return StringUtils.hasText(mailHost)
                && StringUtils.hasText(mailUsername)
                && StringUtils.hasText(mailPassword);
    }

    private void logResetLinkForDevelopment(String recipientEmail, String resetLink, LocalDateTime expiresAt) {
        LOGGER.warn(
                "MODE DEVELOPPEMENT — lien de reinitialisation pour {} (expire le {}) : {}",
                recipientEmail,
                expiresAt.format(EXPIRY_FORMAT),
                resetLink);
    }

    private String buildEmailBody(String displayName, String resetLink, LocalDateTime expiresAt) {
        String resolvedName = (displayName == null || displayName.isBlank()) ? "utilisateur" : displayName;

        return "Bonjour " + resolvedName + ",\n\n"
                + "Vous avez demande la reinitialisation de votre mot de passe SmartAssign.\n"
                + "Cliquez sur le lien suivant pour definir un nouveau mot de passe :\n\n"
                + resetLink + "\n\n"
                + "Ce lien expirera le " + expiresAt.format(EXPIRY_FORMAT) + ".\n"
                + "Si vous n'etes pas a l'origine de cette demande, ignorez simplement ce message.\n\n"
                + "Equipe SmartAssign";
    }

    private static String maskEmail(String email) {
        if (!StringUtils.hasText(email)) {
            return "(vide)";
        }
        int at = email.indexOf('@');
        if (at <= 1) {
            return "***";
        }
        return email.charAt(0) + "***" + email.substring(at);
    }
}
