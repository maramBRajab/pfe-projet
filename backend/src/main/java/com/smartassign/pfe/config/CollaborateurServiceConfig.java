package com.smartassign.pfe.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Primary;
import org.springframework.security.crypto.password.PasswordEncoder;

import com.smartassign.pfe.repository.AffectationRepository;
import com.smartassign.pfe.repository.CollaborateurRepository;
import com.smartassign.pfe.repository.CompetenceRepository;
import com.smartassign.pfe.repository.CongeRepository;
import com.smartassign.pfe.repository.DisponibiliteUtilisateurRepository;
import com.smartassign.pfe.repository.EmailVerificationTokenRepository;
import com.smartassign.pfe.repository.JalonRepository;
import com.smartassign.pfe.repository.PasswordResetTokenRepository;
import com.smartassign.pfe.repository.TacheRepository;
import com.smartassign.pfe.repository.UtilisateurRepository;
import com.smartassign.pfe.service.CollaborateurService;
import com.smartassign.pfe.service.CollaborateurServiceImpl;
import com.smartassign.pfe.service.CredentialsMailService;
import com.smartassign.pfe.service.EmailDomainValidatorService;

@Configuration
public class CollaborateurServiceConfig {

    @Bean
    @Primary
    public CollaborateurService collaborateurService(
            CollaborateurRepository collaborateurRepository,
            CompetenceRepository competenceRepository,
            UtilisateurRepository utilisateurRepository,
            AffectationRepository affectationRepository,
            TacheRepository tacheRepository,
            JalonRepository jalonRepository,
            DisponibiliteUtilisateurRepository disponibiliteUtilisateurRepository,
            EmailVerificationTokenRepository emailVerificationTokenRepository,
            CongeRepository congeRepository,
            PasswordResetTokenRepository passwordResetTokenRepository,
            PasswordEncoder passwordEncoder,
            CredentialsMailService credentialsMailService,
            EmailDomainValidatorService emailDomainValidatorService,
            AppMailProperties appMailProperties) {
        return new CollaborateurServiceImpl(
                collaborateurRepository,
                competenceRepository,
                utilisateurRepository,
                affectationRepository,
                tacheRepository,
                jalonRepository,
                disponibiliteUtilisateurRepository,
                emailVerificationTokenRepository,
                congeRepository,
                passwordResetTokenRepository,
                passwordEncoder,
                credentialsMailService,
                emailDomainValidatorService,
                appMailProperties);
    }
}
