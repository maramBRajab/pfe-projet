package com.smartassign.pfe.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.MailAuthenticationException;
import org.springframework.mail.MailException;
import org.springframework.mail.MailSendException;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import com.smartassign.pfe.config.AppMailProperties;
import com.smartassign.pfe.exception.BusinessException;

import jakarta.mail.MessagingException;
import jakarta.mail.internet.MimeMessage;

/**
 * Service centralise d'envoi des emails contenant les identifiants
 * (compte cree, renvoi de mot de passe temporaire).
 *
 * <p>Contrairement aux anciennes implementations, ce service :
 * <ul>
 *   <li>ne masque pas les erreurs SMTP — chaque echec est journalise avec sa cause
 *       et leve une {@link BusinessException} explicite pour le code appelant ;</li>
 *   <li>verifie que les identifiants SMTP sont configures avant l'envoi ;</li>
 *   <li>distingue les erreurs d'authentification, de connexion et d'envoi.</li>
 * </ul>
 */
@Service
public class CredentialsMailService {

    private static final Logger LOGGER = LoggerFactory.getLogger(CredentialsMailService.class);

    private final JavaMailSender mailSender;
    private final AppMailProperties appMailProperties;

    @Value("${spring.mail.host:}")
    private String mailHost;

    @Value("${spring.mail.username:}")
    private String mailUsername;

    @Value("${spring.mail.password:}")
    private String mailPassword;

    public CredentialsMailService(JavaMailSender mailSender, AppMailProperties appMailProperties) {
        this.mailSender = mailSender;
        this.appMailProperties = appMailProperties;
    }

    /**
     * Envoie un email contenant les identifiants (email + mot de passe temporaire)
     * a un destinataire. En cas d'echec, leve une {@link BusinessException} avec un
     * message explicite ; le code appelant decide alors s'il faut rollback ou non.
     */
    public void sendCredentialsEmail(
            String recipientEmail,
            String displayName,
            String temporaryPassword,
            CredentialsMailKind kind) {

        if (!StringUtils.hasText(recipientEmail)) {
            throw new BusinessException("Adresse email destinataire manquante.");
        }
        if (!StringUtils.hasText(temporaryPassword)) {
            throw new BusinessException("Mot de passe temporaire manquant — envoi annule.");
        }

        if (!appMailProperties.isEnabled()) {
            LOGGER.warn(
                    "[EMAIL] app.mail.enabled=false — email '{}' pour {} non envoye (mode desactive).",
                    kind.code(), recipientEmail);
            throw new BusinessException(
                    "L'envoi d'email est desactive (app.mail.enabled=false). "
                            + "Activez-le ou transmettez les identifiants manuellement.");
        }

        if (!isSmtpConfigured()) {
            LOGGER.error(
                    "[EMAIL] SMTP incomplet pour '{}' (destinataire={}) — host renseigne={}, "
                            + "username renseigne={}, password renseigne={}",
                    kind.code(), recipientEmail,
                    StringUtils.hasText(mailHost),
                    StringUtils.hasText(mailUsername),
                    StringUtils.hasText(mailPassword));
            throw new BusinessException(
                    "Le service d'envoi d'email n'est pas configure. "
                            + "Definissez SPRING_MAIL_HOST, SPRING_MAIL_USERNAME et SPRING_MAIL_PASSWORD "
                            + "(mot de passe d'application Gmail).");
        }

        String resolvedDisplayName = StringUtils.hasText(displayName) ? displayName.trim() : recipientEmail;
        String subject = kind.subject();
        String html = buildEmailHtml(resolvedDisplayName, recipientEmail, temporaryPassword, kind);

        try {
            MimeMessage message = mailSender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(message, true, "UTF-8");
            helper.setFrom(appMailProperties.getFrom());
            helper.setTo(recipientEmail);
            helper.setSubject(subject);
            helper.setText(html, true);

            LOGGER.info("[EMAIL] Envoi '{}' vers {} via {}", kind.code(), recipientEmail, mailHost.trim());
            mailSender.send(message);
            LOGGER.info("[EMAIL] '{}' envoye avec succes a {}", kind.code(), recipientEmail);

        } catch (MailAuthenticationException exception) {
            LOGGER.error(
                    "[EMAIL] Authentification SMTP refusee (host={}, user={}) — verifiez "
                            + "SPRING_MAIL_USERNAME / SPRING_MAIL_PASSWORD (mot de passe d'application Gmail). "
                            + "Cause : {}",
                    mailHost, maskEmail(mailUsername), exception.getMessage(), exception);
            throw new BusinessException(
                    "Authentification SMTP refusee. Verifiez les identifiants email du serveur.");

        } catch (MailSendException exception) {
            LOGGER.error(
                    "[EMAIL] Echec d'envoi vers {} via {} — cause : {}",
                    recipientEmail, mailHost, exception.getMessage(), exception);
            throw new BusinessException(
                    "Le serveur de messagerie a refuse l'envoi. Verifiez la connectivite SMTP "
                            + "et que l'adresse destinataire est valide.");

        } catch (MailException exception) {
            LOGGER.error(
                    "[EMAIL] Erreur de messagerie vers {} : {}",
                    recipientEmail, exception.getMessage(), exception);
            throw new BusinessException(
                    "Impossible d'envoyer l'email pour le moment. Verifiez la configuration SMTP.");

        } catch (MessagingException exception) {
            LOGGER.error(
                    "[EMAIL] Construction du message echouee pour {} : {}",
                    recipientEmail, exception.getMessage(), exception);
            throw new BusinessException(
                    "La construction de l'email a echoue. Contactez l'administrateur.");
        }
    }

    private boolean isSmtpConfigured() {
        return StringUtils.hasText(mailHost)
                && StringUtils.hasText(mailUsername)
                && StringUtils.hasText(mailPassword);
    }

    private String buildEmailHtml(String displayName, String email, String tempPassword, CredentialsMailKind kind) {
        String headerTitle = kind == CredentialsMailKind.WELCOME
                ? "Bienvenue, " + escape(displayName) + " !"
                : "Vos nouveaux identifiants SmartAssign";
        String intro = kind == CredentialsMailKind.WELCOME
                ? "Votre compte a ete cree avec succes. Voici vos identifiants :"
                : "Vous avez demande le renvoi de vos identifiants. Un nouveau mot de passe "
                        + "temporaire a ete genere :";

        return "<div style='font-family:Arial,sans-serif;max-width:520px;margin:auto;border:1px solid #e2e8f0;border-radius:10px;overflow:hidden'>"
                + "<div style='background:#1e293b;padding:24px;text-align:center'>"
                + "  <h1 style='color:#fff;margin:0;font-size:22px'>SmartAssign</h1>"
                + "</div>"
                + "<div style='padding:32px'>"
                + "  <h2 style='color:#1e293b;margin-top:0'>" + headerTitle + "</h2>"
                + "  <p style='color:#475569'>" + intro + "</p>"
                + "  <table style='background:#f8fafc;border-radius:8px;padding:16px;width:100%;border-collapse:collapse'>"
                + "    <tr><td style='color:#64748b;padding:6px 0'>Email</td>"
                + "        <td style='font-weight:bold;color:#1e293b'>" + escape(email) + "</td></tr>"
                + "    <tr><td style='color:#64748b;padding:6px 0'>Mot de passe temporaire</td>"
                + "        <td style='font-weight:bold;color:#7c3aed;font-family:monospace;font-size:15px'>"
                + escape(tempPassword) + "</td></tr>"
                + "  </table>"
                + "  <p style='color:#dc2626;margin-top:20px;font-size:13px'>"
                + "    Changez ce mot de passe des votre prochaine connexion."
                + "  </p>"
                + "  <p style='color:#475569'>Connectez-vous sur <strong>http://localhost:4200</strong></p>"
                + "</div>"
                + "<div style='background:#f1f5f9;padding:16px;text-align:center;font-size:12px;color:#94a3b8'>"
                + "  L'equipe SmartAssign"
                + "</div></div>";
    }

    private static String escape(String value) {
        if (value == null) {
            return "";
        }
        return value.replace("&", "&amp;")
                .replace("<", "&lt;")
                .replace(">", "&gt;")
                .replace("\"", "&quot;");
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

    public enum CredentialsMailKind {
        WELCOME("welcome", "Bienvenue sur SmartAssign — vos identifiants"),
        RESEND("resend", "SmartAssign — renvoi de vos identifiants");

        private final String code;
        private final String subject;

        CredentialsMailKind(String code, String subject) {
            this.code = code;
            this.subject = subject;
        }

        public String code() {
            return code;
        }

        public String subject() {
            return subject;
        }
    }

    public void sendEmailVerification(
            String recipientEmail,
            String displayName,
            String verificationLink,
            String verificationCode) {

        if (!StringUtils.hasText(recipientEmail)) {
            throw new BusinessException("Adresse email destinataire manquante.");
        }

        if (!StringUtils.hasText(verificationLink)) {
            throw new BusinessException("Lien de verification manquant.");
        }

        if (!appMailProperties.isEnabled()) {
            LOGGER.warn("[EMAIL] app.mail.enabled=false — email de verification non envoye a {}", recipientEmail);
            throw new BusinessException("L'envoi d'email est desactive.");
        }

        if (!isSmtpConfigured()) {
            LOGGER.error(
                    "[EMAIL] SMTP incomplet pour verification email (destinataire={}) — host renseigne={}, username renseigne={}, password renseigne={}",
                    recipientEmail,
                    StringUtils.hasText(mailHost),
                    StringUtils.hasText(mailUsername),
                    StringUtils.hasText(mailPassword));
            throw new BusinessException("Le service d'envoi d'email n'est pas configure.");
        }

        String resolvedDisplayName = StringUtils.hasText(displayName) ? displayName.trim() : recipientEmail;
        String html = "<div style='font-family:Arial,sans-serif;max-width:560px;margin:auto;border:1px solid #e2e8f0;border-radius:10px;overflow:hidden'>"
                + "<div style='background:#0f172a;padding:24px;text-align:center'>"
                + "  <h1 style='color:#fff;margin:0;font-size:22px'>SmartAssign</h1>"
                + "</div>"
                + "<div style='padding:28px'>"
                + "  <h2 style='color:#1e293b;margin-top:0'>Verification de votre adresse email</h2>"
                + "  <p style='color:#334155'>Bonjour " + escape(resolvedDisplayName) + ",</p>"
                + "  <p style='color:#475569'>Veuillez confirmer votre adresse email pour finaliser l'activation du compte :</p>"
                + "  <p style='text-align:center;margin:26px 0'>"
                + "    <a href='" + escape(verificationLink) + "' style='display:inline-block;background:#2563eb;color:#fff;text-decoration:none;padding:12px 18px;border-radius:8px;font-weight:700'>Confirmer mon email</a>"
                + "  </p>"
                + "  <p style='color:#64748b;font-size:13px'>Si le bouton ne fonctionne pas, utilisez ce lien :<br><a href='" + escape(verificationLink) + "'>" + escape(verificationLink) + "</a></p>"
                + "  <p style='color:#64748b;font-size:13px'>Code de confirmation : <strong style='font-family:monospace'>" + escape(verificationCode) + "</strong></p>"
                + "</div>"
                + "<div style='background:#f8fafc;padding:14px;text-align:center;font-size:12px;color:#94a3b8'>Equipe SmartAssign</div>"
                + "</div>";

        try {
            MimeMessage message = mailSender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(message, true, "UTF-8");
            helper.setFrom(appMailProperties.getFrom());
            helper.setTo(recipientEmail);
            helper.setSubject("SmartAssign — verification de votre email");
            helper.setText(html, true);
            mailSender.send(message);
            LOGGER.info("[EMAIL] Verification email envoyee a {}", recipientEmail);
        } catch (MailAuthenticationException exception) {
            LOGGER.error("[EMAIL] Auth SMTP refusee pour verification email vers {} : {}", recipientEmail, exception.getMessage(), exception);
            throw new BusinessException("Authentification SMTP refusee.");
        } catch (MailSendException exception) {
            LOGGER.error("[EMAIL] Echec envoi verification email vers {} : {}", recipientEmail, exception.getMessage(), exception);
            throw new BusinessException("Le serveur de messagerie a refuse l'envoi.");
        } catch (MailException exception) {
            LOGGER.error("[EMAIL] Erreur messagerie verification email vers {} : {}", recipientEmail, exception.getMessage(), exception);
            throw new BusinessException("Impossible d'envoyer l'email de verification.");
        } catch (MessagingException exception) {
            LOGGER.error("[EMAIL] Construction message verification echouee pour {} : {}", recipientEmail, exception.getMessage(), exception);
            throw new BusinessException("La construction de l'email de verification a echoue.");
        }
    }
}
