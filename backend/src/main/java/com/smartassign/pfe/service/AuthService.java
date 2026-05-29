package com.smartassign.pfe.service;

import java.util.List;

import com.smartassign.pfe.dto.AuthRequest;
import com.smartassign.pfe.dto.AuthResponse;
import com.smartassign.pfe.dto.ForgotPasswordRequest;
import com.smartassign.pfe.dto.MessageResponse;
import com.smartassign.pfe.dto.RegisterRequest;
import com.smartassign.pfe.dto.ResetPasswordRequest;
import com.smartassign.pfe.dto.UserPreferencesRequest;
import com.smartassign.pfe.dto.UserPreferencesResponse;
import com.smartassign.pfe.dto.UtilisateurResponse;

public interface AuthService {

    List<UtilisateurResponse> getUsers();

    AuthResponse login(AuthRequest request);

    AuthResponse register(RegisterRequest request);

    MessageResponse requestPasswordReset(ForgotPasswordRequest request);

    MessageResponse validatePasswordResetToken(String token);

    MessageResponse resetPassword(ResetPasswordRequest request);

    UserPreferencesResponse getCurrentUserPreferences(String email);

    UserPreferencesResponse updateCurrentUserPreferences(String email, UserPreferencesRequest request);

    void initAdminSiAbsent();
}
