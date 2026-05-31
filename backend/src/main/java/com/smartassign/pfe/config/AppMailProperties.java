package com.smartassign.pfe.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "app.mail")
public class AppMailProperties {

    /** Active l'envoi SMTP (desactive = journalisation du lien uniquement si dev-log actif). */
    private boolean enabled = true;

    /**
     * En developpement : si les identifiants SMTP sont absents, journalise le lien de
     * reinitialisation au lieu d'echouer (ne jamais activer en production).
     */
    private boolean devLogResetLink = false;

    /** Adresse expediteur affichee dans l'email. */
    private String from = "SmartAssign <noreply@smartassign.local>";

    public boolean isEnabled() {
        return enabled;
    }

    public void setEnabled(boolean enabled) {
        this.enabled = enabled;
    }

    public boolean isDevLogResetLink() {
        return devLogResetLink;
    }

    public void setDevLogResetLink(boolean devLogResetLink) {
        this.devLogResetLink = devLogResetLink;
    }

    public String getFrom() {
        return from;
    }

    public void setFrom(String from) {
        this.from = from;
    }
}
