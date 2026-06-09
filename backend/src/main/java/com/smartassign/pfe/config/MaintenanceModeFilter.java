package com.smartassign.pfe.config;

import com.smartassign.pfe.entity.Settings;
import com.smartassign.pfe.service.SettingsService;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Lazy;
import org.springframework.core.annotation.Order;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;

/**
 * Quand "modeMaintenance" est ON dans la table settings, ce filtre renvoie 503
 * pour tout appel non-admin sauf pour la connexion, le CSRF et les paramètres
 * (afin que l'admin puisse désactiver la maintenance).
 */
@Component
@Order(1)
public class MaintenanceModeFilter extends OncePerRequestFilter {

    private static final Logger LOGGER = LoggerFactory.getLogger(MaintenanceModeFilter.class);

    private final SettingsService settingsService;

    @Autowired
    public MaintenanceModeFilter(@Lazy SettingsService settingsService) {
        this.settingsService = settingsService;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                    HttpServletResponse response,
                                    FilterChain filterChain) throws ServletException, IOException {

        if (isAlwaysAllowed(request)) {
            filterChain.doFilter(request, response);
            return;
        }

        boolean maintenance;
        try {
            Settings cfg = settingsService.getOrCreate();
            maintenance = Boolean.TRUE.equals(cfg.getModeMaintenance());
        } catch (Exception e) {
            // En cas d'erreur de lecture des settings, on laisse passer
            filterChain.doFilter(request, response);
            return;
        }

        if (!maintenance) {
            filterChain.doFilter(request, response);
            return;
        }

        if (isAdmin()) {
            filterChain.doFilter(request, response);
            return;
        }

        LOGGER.info("[MAINTENANCE] requête bloquée : {} {}", request.getMethod(), request.getRequestURI());
        response.setStatus(HttpServletResponse.SC_SERVICE_UNAVAILABLE);
        response.setHeader("Retry-After", "120");
        response.setContentType("application/json;charset=UTF-8");
        response.getWriter().write(
                "{\"error\":\"MAINTENANCE\",\"message\":\"La plateforme est en mode maintenance. Réessayez plus tard.\"}");
    }

    private boolean isAlwaysAllowed(HttpServletRequest request) {
        String uri = request.getRequestURI();
        if (uri == null) return true;
        // Endpoints toujours autorisés (sinon l'admin ne peut plus se connecter ni désactiver la maintenance)
        return uri.startsWith("/api/auth/login")
                || uri.startsWith("/api/auth/csrf-token")
                || uri.startsWith("/api/auth/forgot-password")
                || uri.startsWith("/api/auth/reset-password")
                || uri.startsWith("/api/auth/renvoyer-identifiants")
                || uri.startsWith("/api/admin/settings")
                || uri.equals("/error")
                || "OPTIONS".equalsIgnoreCase(request.getMethod());
    }

    private boolean isAdmin() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !auth.isAuthenticated()) return false;
        for (GrantedAuthority ga : auth.getAuthorities()) {
            String a = ga.getAuthority();
            if (a != null && a.toUpperCase().contains("ADMIN")) return true;
        }
        return false;
    }
}
