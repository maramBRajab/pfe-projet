package com.smartassign.pfe.security;

import java.util.List;

import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.userdetails.User;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.smartassign.pfe.entity.Utilisateur;
import com.smartassign.pfe.repository.UtilisateurRepository;

import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class CustomUserDetailsService implements UserDetailsService {

    private final UtilisateurRepository utilisateurRepository;

    @Override
    @Transactional(readOnly = true)
    public UserDetails loadUserByUsername(String username) throws UsernameNotFoundException {
        String normalizedEmail = normalizeEmail(username);

        Utilisateur utilisateur = utilisateurRepository.findByEmailIgnoreCase(normalizedEmail)
                .orElseThrow(() -> new UsernameNotFoundException("Utilisateur introuvable : " + normalizedEmail));

        String storedPassword = utilisateur.getMotDePasse();
        if (storedPassword == null || storedPassword.isBlank()) {
            throw new UsernameNotFoundException("Mot de passe non configure pour : " + normalizedEmail);
        }

        String role = RoleNormalizer.normalize(utilisateur.getRole());

        return User.builder()
                .username(normalizedEmail)
                .password(storedPassword)
                .authorities(List.of(new SimpleGrantedAuthority("ROLE_" + role)))
                .build();
    }

    private static String normalizeEmail(String email) {
        return email == null ? "" : email.trim().toLowerCase();
    }
}
