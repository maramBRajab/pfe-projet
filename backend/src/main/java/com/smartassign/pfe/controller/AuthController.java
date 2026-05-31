package com.smartassign.pfe.controller;

import java.util.List;
import java.util.Map;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.web.csrf.CsrfToken;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.web.bind.annotation.*;

import com.smartassign.pfe.dto.AuthRequest;
import com.smartassign.pfe.dto.AuthResponse;
import com.smartassign.pfe.dto.ForgotPasswordRequest;
import com.smartassign.pfe.dto.MessageResponse;
import com.smartassign.pfe.dto.RegisterRequest;
import com.smartassign.pfe.dto.ResetPasswordRequest;
import com.smartassign.pfe.dto.UserPreferencesRequest;
import com.smartassign.pfe.dto.UserPreferencesResponse;
import com.smartassign.pfe.dto.UtilisateurResponse;
import com.smartassign.pfe.dto.UpdateProfileRequest;
import com.smartassign.pfe.dto.UpdateProfileResponse;
import com.smartassign.pfe.dto.ChangePasswordRequest;
import org.springframework.security.access.prepost.PreAuthorize;
import com.smartassign.pfe.service.AuthService;
import com.smartassign.pfe.service.AuditLogService;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;

@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
public class AuthController {

    private static final Logger LOGGER = LoggerFactory.getLogger(AuthController.class);

    private final AuthService service;
    private final AuditLogService auditLogService;

    @GetMapping("/users")
    public ResponseEntity<List<UtilisateurResponse>> getUsers() {
        return ResponseEntity.ok(service.getUsers());
    }

    @GetMapping("/csrf-token")
    public ResponseEntity<Map<String, String>> getCsrfToken(CsrfToken csrfToken) {
        return ResponseEntity.ok(Map.of(
                "token", csrfToken.getToken(),
                "headerName", csrfToken.getHeaderName(),
                "parameterName", csrfToken.getParameterName()));
    }

    @PostMapping("/login")
    public ResponseEntity<AuthResponse> login(
            @Valid @RequestBody AuthRequest request,
            HttpServletRequest httpRequest) {
        try {
            AuthResponse authResponse = service.login(request);
            auditLogService.log(
                request.getEmail(),
                authResponse.getRole(),
                "LOGIN",
                "Connexion réussie",
                httpRequest.getRemoteAddr(),
                "SUCCESS",
                null,
                null
            );
            return ResponseEntity.ok(authResponse);
        } catch (Exception e) {
            auditLogService.log(
                request.getEmail(),
                "INCONNU",
                "LOGIN_FAILED",
                "Échec d'authentification : " + e.getMessage(),
                httpRequest.getRemoteAddr(),
                "FAILED",
                null,
                null
            );
            throw e;
        }
    }

    @PostMapping("/register")
    public ResponseEntity<AuthResponse> register(
            @Valid @RequestBody RegisterRequest request) {
        return ResponseEntity.ok(service.register(request));
    }

    @PostMapping("/forgot-password")
    public ResponseEntity<MessageResponse> forgotPassword(
            @Valid @RequestBody ForgotPasswordRequest request) {
        LOGGER.info("POST /api/auth/forgot-password pour {}", request.getEmail());
        MessageResponse response = service.requestPasswordReset(request);
        LOGGER.info("Reponse forgot-password envoyee pour {}", request.getEmail());
        return ResponseEntity.ok(response);
    }

    @GetMapping("/reset-password/validate")
    public ResponseEntity<MessageResponse> validateResetPasswordToken(@RequestParam String token) {
        return ResponseEntity.ok(service.validatePasswordResetToken(token));
    }

    @PostMapping("/reset-password")
    public ResponseEntity<MessageResponse> resetPassword(
            @Valid @RequestBody ResetPasswordRequest request) {
        return ResponseEntity.ok(service.resetPassword(request));
    }

    @GetMapping("/me/preferences")
    public ResponseEntity<UserPreferencesResponse> getCurrentUserPreferences(Authentication authentication) {
        return ResponseEntity.ok(service.getCurrentUserPreferences(authentication.getName()));
    }

    @PutMapping("/me/preferences")
    public ResponseEntity<UserPreferencesResponse> updateCurrentUserPreferences(
            Authentication authentication,
            @Valid @RequestBody UserPreferencesRequest request) {
        return ResponseEntity.ok(service.updateCurrentUserPreferences(authentication.getName(), request));
    }

    @PutMapping("/me/profile")
    public ResponseEntity<UpdateProfileResponse> updateProfile(
            Authentication authentication,
            @RequestBody UpdateProfileRequest request) {
        return ResponseEntity.ok(service.updateProfile(authentication.getName(), request));
    }

    @PutMapping("/me/password")
    public ResponseEntity<MessageResponse> changePassword(
            Authentication authentication,
            @RequestBody ChangePasswordRequest request) {
        return ResponseEntity.ok(service.changePassword(authentication.getName(), request));
    }
}