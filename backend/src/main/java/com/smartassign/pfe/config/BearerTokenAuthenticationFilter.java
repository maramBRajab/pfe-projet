package com.smartassign.pfe.config;

import java.io.IOException;
import java.util.List;

import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import com.smartassign.pfe.entity.Utilisateur;
import com.smartassign.pfe.repository.UtilisateurRepository;
import com.smartassign.pfe.security.JwtService;
import com.smartassign.pfe.security.RoleNormalizer;

import io.jsonwebtoken.JwtException;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;

@Component
@RequiredArgsConstructor
public class BearerTokenAuthenticationFilter extends OncePerRequestFilter {

    private final UtilisateurRepository utilisateurRepository;
    private final JwtService jwtService;

    @Override
    protected void doFilterInternal(
        HttpServletRequest request,
        HttpServletResponse response,
        FilterChain filterChain
    ) throws ServletException, IOException {
        String authorizationHeader = request.getHeader(HttpHeaders.AUTHORIZATION);

        if (authorizationHeader == null || authorizationHeader.isBlank()) {
            filterChain.doFilter(request, response);
            return;
        }

        if (!authorizationHeader.startsWith("Bearer ")) {
            unauthorized(response, "Format de jeton invalide");
            return;
        }

        String token = authorizationHeader.substring(7).trim();
        Utilisateur utilisateur = resolveUtilisateur(token);

        if (utilisateur == null) {
            unauthorized(response, "Jeton invalide ou expire");
            return;
        }

        if (Boolean.FALSE.equals(utilisateur.getActif())) {
            unauthorized(response, "Compte suspendu");
            return;
        }

        UsernamePasswordAuthenticationToken authentication = new UsernamePasswordAuthenticationToken(
            utilisateur.getEmail(),
            null,
            List.of(new SimpleGrantedAuthority("ROLE_" + RoleNormalizer.normalize(utilisateur.getRole())))
        );

        SecurityContextHolder.getContext().setAuthentication(authentication);
        filterChain.doFilter(request, response);
    }

    private Utilisateur resolveUtilisateur(String token) {
        try {
            String email = jwtService.extractSubject(token);
            return utilisateurRepository.findByEmailIgnoreCase(email).orElse(null);
        } catch (JwtException | IllegalArgumentException exception) {
            return null;
        }
    }

    private void unauthorized(HttpServletResponse response, String message) throws IOException {
        response.setStatus(HttpStatus.UNAUTHORIZED.value());
        response.setContentType("application/json");
        response.setCharacterEncoding("UTF-8");
        response.getWriter().write("{\"message\":\"" + message + "\"}");
    }
}