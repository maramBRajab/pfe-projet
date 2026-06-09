package com.smartassign.pfe.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import com.smartassign.pfe.exception.BusinessException;

import javax.naming.NamingException;
import javax.naming.directory.Attributes;
import javax.naming.directory.InitialDirContext;
import java.net.UnknownHostException;
import java.util.Hashtable;
import java.util.Set;

/**
 * Valide qu'une adresse email est susceptible d'être délivrable en vérifiant
 * que le domaine possède un enregistrement MX (ou A en fallback).
 *
 * <p>Cette validation est effectuée AVANT la création du compte afin d'éviter
 * de persister des comptes pour des adresses manifestement non délivrables.
 * Elle ne garantit pas l'existence de la boîte mail individuelle, mais détecte
 * les domaines fantaisistes / sans serveur de messagerie.
 */
@Service
public class EmailDomainValidatorService {

    private static final Logger LOGGER = LoggerFactory.getLogger(EmailDomainValidatorService.class);
    private static final int DNS_TIMEOUT_MS = 5000;

    /**
     * Domaines de messagerie grand public connus — la vérification DNS est ignorée
     * pour eux car leur existence est certaine.
     */
    private static final Set<String> TRUSTED_DOMAINS = Set.of(
        "gmail.com", "googlemail.com",
        "outlook.com", "hotmail.com", "hotmail.fr", "live.com", "live.fr",
        "yahoo.com", "yahoo.fr",
        "icloud.com", "me.com",
        "protonmail.com", "proton.me",
        "orange.fr", "sfr.fr", "laposte.net",
        "entreprise.com"
    );

    /**
     * Retourne {@code true} si le domaine de l'email possède un enregistrement
     * MX ou A valide (domaine résolvable).
     * Retourne {@code true} pour les domaines grand-public connus sans effectuer de DNS.
     */
    public boolean isDomainValid(String email) {
        if (email == null || !email.contains("@")) {
            return false;
        }

        String domain = email.substring(email.indexOf('@') + 1).trim().toLowerCase();
        if (domain.isBlank()) {
            return false;
        }

        // Domaines connus : pas besoin de DNS
        if (TRUSTED_DOMAINS.contains(domain)) {
            LOGGER.debug("[EMAIL-DOMAIN] Domaine de confiance : {}", domain);
            return true;
        }

        // Vérification MX en priorité, A record en fallback
        return hasMxRecord(domain) || hasARecord(domain);
    }

    /**
     * Lance une {@link BusinessException} si le domaine de l'email ne dispose
     * d'aucun enregistrement DNS valide.
     */
    public void assertEmailDeliverable(String email) {
        if (!isDomainValid(email)) {
            LOGGER.warn("[EMAIL-DOMAIN] Domaine non délivrable pour : {}", email);
            throw new BusinessException(
                "Impossible de créer l'utilisateur. L'adresse email semble invalide ou ne peut pas recevoir d'emails."
            );
        }
    }

    // ── DNS helpers ───────────────────────────────────────────────────────────

    private boolean hasMxRecord(String domain) {
        try {
            Hashtable<String, String> env = new Hashtable<>();
            env.put("java.naming.factory.initial", "com.sun.jndi.dns.DnsContextFactory");
            env.put("java.naming.provider.url", "dns:");
            env.put("com.sun.jndi.dns.timeout.initial", String.valueOf(DNS_TIMEOUT_MS));
            env.put("com.sun.jndi.dns.timeout.retries", "1");

            InitialDirContext ctx = new InitialDirContext(env);
            try {
                Attributes attrs = ctx.getAttributes(domain, new String[]{"MX"});
                boolean hasMx = attrs.get("MX") != null;
                LOGGER.debug("[DNS-MX] Enregistrement MX pour '{}' : {}", domain, hasMx);
                return hasMx;
            } finally {
                ctx.close();
            }
        } catch (NamingException e) {
            LOGGER.debug("[DNS-MX] Echec lookup MX pour '{}' : {}", domain, e.getMessage());
            return false;
        }
    }

    private boolean hasARecord(String domain) {
        try {
            java.net.InetAddress.getByName(domain);
            LOGGER.debug("[DNS-A] Domaine '{}' résolvable", domain);
            return true;
        } catch (UnknownHostException e) {
            LOGGER.debug("[DNS-A] Domaine '{}' non résolvable", domain);
            return false;
        }
    }
}
