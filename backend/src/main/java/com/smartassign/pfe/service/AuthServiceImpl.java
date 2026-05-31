package com.smartassign.pfe.service;

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.Base64;
import java.util.Comparator;
import java.util.HexFormat;
import java.util.List;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;
import java.util.stream.Collectors;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

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
import org.springframework.security.core.context.SecurityContextHolder;
import com.smartassign.pfe.entity.Affectation;
import com.smartassign.pfe.entity.Collaborateur;
import com.smartassign.pfe.entity.Competence;
import com.smartassign.pfe.entity.Conge;
import com.smartassign.pfe.entity.PasswordResetToken;
import com.smartassign.pfe.entity.Projet;
import com.smartassign.pfe.entity.Tache;
import com.smartassign.pfe.entity.Utilisateur;
import com.smartassign.pfe.exception.BusinessException;
import com.smartassign.pfe.exception.ResourceNotFoundException;
import com.smartassign.pfe.repository.AffectationRepository;
import com.smartassign.pfe.repository.CollaborateurRepository;
import com.smartassign.pfe.repository.CompetenceRepository;
import com.smartassign.pfe.repository.CongeRepository;
import com.smartassign.pfe.repository.PasswordResetTokenRepository;
import com.smartassign.pfe.repository.ProjetRepository;
import com.smartassign.pfe.repository.TacheRepository;
import com.smartassign.pfe.repository.UtilisateurRepository;
import com.smartassign.pfe.security.JwtService;
import com.smartassign.pfe.security.PasswordHashUtils;
import com.smartassign.pfe.security.RoleNormalizer;

import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
@Transactional
public class AuthServiceImpl implements AuthService {

    private static final Logger LOGGER = LoggerFactory.getLogger(AuthServiceImpl.class);
    private static final Base64.Encoder TOKEN_ENCODER = Base64.getUrlEncoder().withoutPadding();

    private final UtilisateurRepository utilisateurRepository;
    private final CollaborateurRepository collaborateurRepository;
    private final CompetenceRepository competenceRepository;
    private final AffectationRepository affectationRepository;
    private final ProjetRepository projetRepository;
    private final TacheRepository tacheRepository;
    private final CongeRepository congeRepository;
    private final PasswordResetTokenRepository passwordResetTokenRepository;
    private final PasswordResetNotificationService passwordResetNotificationService;
    private final JdbcTemplate jdbcTemplate;
    private final JwtService jwtService;
    private final PasswordEncoder passwordEncoder;
    private final AuthenticationManager authenticationManager;

    @Value("${app.password-reset.token-expiration-minutes:30}")
    private long passwordResetExpirationMinutes;

    @Value("${app.frontend.reset-password-url:http://localhost:4200/reset-password}")
    private String resetPasswordUrl;

    @Transactional(readOnly = true)
    public List<UtilisateurResponse> getUsers() {
        return utilisateurRepository.findAll().stream()
                .sorted(Comparator
                        .comparingInt((Utilisateur user) -> rolePriority(user.getRole()))
                        .thenComparing(Utilisateur::getNom, String.CASE_INSENSITIVE_ORDER))
                .map(this::toUtilisateurResponse)
                .toList();
    }

    public AuthResponse login(AuthRequest request) {
        String normalizedEmail = normalizeEmail(request.getEmail());
        String rawPassword = normalizeRawPassword(request.getMotDePasse());

        LOGGER.info("Tentative de connexion pour {}", normalizedEmail);

        Utilisateur user = utilisateurRepository.findByEmailIgnoreCase(normalizedEmail)
                .orElseThrow(() -> {
                    LOGGER.warn("Connexion echouee — email inconnu : {}", normalizedEmail);
                    return new BusinessException("Email ou mot de passe incorrect");
                });

        LOGGER.debug(
                "Utilisateur trouve : id={}, email={}, role={}",
                user.getId(),
                user.getEmail(),
                user.getRole());

        upgradeLegacyPasswordIfNeeded(user, rawPassword);
        authenticateCredentials(normalizedEmail, rawPassword);

        String normalizedRole = RoleNormalizer.normalize(user.getRole());
        if (!normalizedRole.equals(user.getRole())) {
            user.setRole(normalizedRole);
            utilisateurRepository.save(user);
        }

        LOGGER.info("Connexion reussie pour {} (role={})", normalizedEmail, normalizedRole);

        return AuthResponse.builder()
                .id(user.getId())
                .nom(user.getNom())
                .email(user.getEmail())
                .role(normalizedRole)
                .token(jwtService.generateToken(user))
                .build();
    }

    public AuthResponse register(RegisterRequest request) {
        String normalizedNom = normalizeNamePart(request.getNom());
        String normalizedPrenom = normalizeNamePart(request.getPrenom());
        String normalizedEmail = normalizeEmail(request.getEmail());
        String normalizedPassword = request.getMotDePasse() == null ? "" : request.getMotDePasse().trim();

        validateStrongPassword(normalizedPassword);

        if (utilisateurRepository.existsByEmailIgnoreCase(normalizedEmail)
                || collaborateurRepository.existsByEmailIgnoreCase(normalizedEmail)) {
            throw new BusinessException("Un compte existe deja avec cet email");
        }

        collaborateurRepository.save(Collaborateur.builder()
                .nom(normalizedNom)
                .prenom(normalizedPrenom)
                .email(normalizedEmail)
                .role("COLLAB")
                .experienceAnnees(request.getExperienceAnnees())
                .disponible(request.isDisponible())
                .competences(resolveCompetences(request.getCompetenceIds()))
                .build());

        Utilisateur user = utilisateurRepository.save(Utilisateur.builder()
                .nom(buildDisplayName(normalizedPrenom, normalizedNom))
                .email(normalizedEmail)
                .motDePasse(passwordEncoder.encode(normalizedPassword))
                .role("COLLAB")
                .build());

        return AuthResponse.builder()
                .id(user.getId())
                .nom(user.getNom())
                .email(user.getEmail())
                .role(user.getRole())
                .token(jwtService.generateToken(user))
                .build();
    }

    public MessageResponse requestPasswordReset(ForgotPasswordRequest request) {
        String normalizedEmail = normalizeEmail(request.getEmail());
        LOGGER.info("Demande de reinitialisation de mot de passe recue pour {}", normalizedEmail);

        Optional<Utilisateur> utilisateurOptional = utilisateurRepository.findByEmailIgnoreCase(normalizedEmail);

        if (utilisateurOptional.isPresent()) {
            Utilisateur user = utilisateurOptional.get();
            passwordResetTokenRepository.deleteByUtilisateur_Id(user.getId());

            String rawToken = generateResetToken();
            LocalDateTime expiresAt = LocalDateTime.now().plusMinutes(passwordResetExpirationMinutes);

            passwordResetTokenRepository.save(PasswordResetToken.builder()
                    .utilisateur(user)
                    .tokenHash(hashToken(rawToken))
                    .expiresAt(expiresAt)
                    .build());

            String resetLink = buildResetLink(rawToken);
            LOGGER.info(
                    "Token de reinitialisation cree pour l'utilisateur id={} (expiration : {})",
                    user.getId(),
                    expiresAt);

            try {
                passwordResetNotificationService.sendResetPasswordEmail(
                        user.getEmail(),
                        user.getNom(),
                        resetLink,
                        expiresAt);
            } catch (BusinessException exception) {
                LOGGER.warn(
                        "Echec de notification pour la reinitialisation (utilisateur id={}) : {}",
                        user.getId(),
                        exception.getMessage());
                throw exception;
            }
        } else {
            LOGGER.info(
                    "Aucun compte associe a {} — reponse generique renvoyee",
                    normalizedEmail);
        }

        return new MessageResponse(
                "Si un compte existe pour cette adresse, un lien de reinitialisation a ete envoye.");
    }

    @Transactional(readOnly = true)
    public MessageResponse validatePasswordResetToken(String token) {
        resolveActiveResetToken(token);
        return new MessageResponse("Lien de reinitialisation valide.");
    }

    public MessageResponse resetPassword(ResetPasswordRequest request) {
        String token = request.getToken() == null ? "" : request.getToken().trim();
        String newPassword = request.getMotDePasse() == null ? "" : request.getMotDePasse().trim();
        String confirmation = request.getConfirmationMotDePasse() == null ? "" : request.getConfirmationMotDePasse().trim();

        if (!Objects.equals(newPassword, confirmation)) {
            throw new BusinessException("La confirmation du mot de passe ne correspond pas.");
        }

        validateStrongPassword(newPassword);

        PasswordResetToken resetToken = resolveActiveResetToken(token);
        Utilisateur user = resetToken.getUtilisateur();

        if (passwordMatches(newPassword, user.getMotDePasse())) {
            throw new BusinessException("Le nouveau mot de passe doit etre different de l'ancien.");
        }

        user.setMotDePasse(passwordEncoder.encode(newPassword));
        utilisateurRepository.save(user);

        resetToken.setUsedAt(LocalDateTime.now());
        passwordResetTokenRepository.save(resetToken);

        return new MessageResponse("Votre mot de passe a ete modifie avec succes.");
    }

    @Transactional(readOnly = true)
    public UserPreferencesResponse getCurrentUserPreferences(String email) {
        return toUserPreferencesResponse(resolveUtilisateurByEmail(email));
    }

    public UserPreferencesResponse updateCurrentUserPreferences(String email, UserPreferencesRequest request) {
        Utilisateur utilisateur = resolveUtilisateurByEmail(email);

        utilisateur.setNotificationsEnabled(request.getNotificationsEnabled());
        utilisateur.setUrgentAlerts(request.getUrgentAlerts());
        utilisateur.setProjectUpdates(request.getProjectUpdates());
        utilisateur.setUiLanguage(normalizePreference(request.getLanguage(), Set.of("fr", "en", "ar"), "fr"));
        utilisateur.setUiDisplayDensity(normalizePreference(request.getDisplayDensity(), Set.of("compact", "extended"), "extended"));
        utilisateur.setUiTheme(normalizePreference(request.getTheme(), Set.of("dark", "light"), "dark"));

        return toUserPreferencesResponse(utilisateurRepository.save(utilisateur));
    }

    @Override
    public UpdateProfileResponse updateProfile(String currentEmail, UpdateProfileRequest request) {
        Utilisateur user = utilisateurRepository.findByEmailIgnoreCase(currentEmail)
            .orElseThrow(() -> new BusinessException("Utilisateur introuvable"));
        if (request.getNom() != null && !request.getNom().isBlank())
            user.setNom(request.getNom().trim());
        if (request.getEmail() != null && !request.getEmail().isBlank())
            user.setEmail(request.getEmail().toLowerCase().trim());
        if (request.getTelephone() != null)
            user.setTelephone(request.getTelephone().trim());
        if (request.getPoste() != null)
            user.setPoste(request.getPoste().trim());
        if (request.getDepartement() != null)
            user.setDepartement(request.getDepartement().trim());
        utilisateurRepository.save(user);
        return UpdateProfileResponse.builder()
            .id(user.getId()).nom(user.getNom())
            .email(user.getEmail()).role(user.getRole())
            .build();
    }

    @Override
    public MessageResponse changePassword(String currentEmail, ChangePasswordRequest request) {
        Utilisateur user = utilisateurRepository.findByEmailIgnoreCase(currentEmail)
            .orElseThrow(() -> new BusinessException("Utilisateur introuvable"));
        if (!matchesAndUpgradePassword(user, request.getMotDePasseActuel()))
            throw new BusinessException("Mot de passe actuel incorrect");
        if (!request.getNouveauMotDePasse().equals(request.getConfirmationMotDePasse()))
            throw new BusinessException("La confirmation ne correspond pas");
        if (passwordEncoder.matches(request.getNouveauMotDePasse(), user.getMotDePasse()))
            throw new BusinessException("Le nouveau mot de passe doit etre different");
        validateStrongPassword(request.getNouveauMotDePasse());
        user.setMotDePasse(passwordEncoder.encode(request.getNouveauMotDePasse()));
        utilisateurRepository.save(user);
        return new MessageResponse("Mot de passe modifie avec succes");
    }

    private boolean matchesAndUpgradePassword(Utilisateur user, String rawPassword) {
        boolean matches = passwordMatches(rawPassword, user.getMotDePasse());
        if (matches) {
            upgradeLegacyPasswordIfNeeded(user, rawPassword);
        }
        return matches;
    }

    public void initAdminSiAbsent() {
        ensureUtilisateurRoleConstraint();
        syncDemoUser("Admin Principal", "admin@smartassign.tn", "Admin123", "ADMIN");
        syncDemoUser("Manager SmartAssign", "manager@smartassign.tn", "Manager123", "MANAGER");
        syncDemoUser("Collaborateur Demo", "collab@smartassign.tn", "Collab123", "COLLAB");
        syncDemoCollaborateur("Demo", "Collaborateur", "collab@smartassign.tn", 4, true);
        syncDemoPlanningData("collab@smartassign.tn");
    }

    private Utilisateur resolveUtilisateurByEmail(String email) {
        String normalizedEmail = normalizeEmail(email);
        return utilisateurRepository.findByEmailIgnoreCase(normalizedEmail)
                .orElseThrow(() -> new ResourceNotFoundException("Utilisateur introuvable."));
    }

    private UserPreferencesResponse toUserPreferencesResponse(Utilisateur utilisateur) {
        return UserPreferencesResponse.builder()
                .notificationsEnabled(Boolean.TRUE.equals(utilisateur.getNotificationsEnabled()))
                .urgentAlerts(Boolean.TRUE.equals(utilisateur.getUrgentAlerts()))
                .projectUpdates(Boolean.TRUE.equals(utilisateur.getProjectUpdates()))
                .language(normalizePreference(utilisateur.getUiLanguage(), Set.of("fr", "en", "ar"), "fr"))
                .displayDensity(normalizePreference(utilisateur.getUiDisplayDensity(), Set.of("compact", "extended"), "extended"))
                .theme(normalizePreference(utilisateur.getUiTheme(), Set.of("dark", "light"), "dark"))
                .build();
    }

    private String normalizePreference(String value, Set<String> allowedValues, String fallback) {
        String normalized = value == null ? "" : value.trim().toLowerCase();
        return allowedValues.contains(normalized) ? normalized : fallback;
    }

    private void syncDemoUser(String nom, String email, String motDePasse, String role) {
        String normalizedEmail = email.trim().toLowerCase();
        String normalizedRole = RoleNormalizer.normalize(role);

        Utilisateur user = utilisateurRepository.findByEmailIgnoreCase(normalizedEmail)
                .orElseGet(() -> Utilisateur.builder().email(normalizedEmail).build());

        boolean isNew = user.getId() == null;
        String storedPassword = user.getMotDePasse();

        // Ne jamais ecraser un mot de passe BCrypt existant (permet les comptes reels en base)
        boolean shouldSetDemoPassword = isNew
                || storedPassword == null
                || storedPassword.isBlank();

        boolean shouldUpgradePlainDemoPassword = !shouldSetDemoPassword
                && !PasswordHashUtils.isBcryptEncoded(storedPassword)
                && Objects.equals(storedPassword, motDePasse);

        boolean hasChanged = isNew
                || !nom.equals(user.getNom())
                || !normalizedEmail.equalsIgnoreCase(user.getEmail())
                || !normalizedRole.equals(RoleNormalizer.normalize(user.getRole()))
                || shouldSetDemoPassword
                || shouldUpgradePlainDemoPassword;

        if (!hasChanged) {
            return;
        }

        user.setNom(nom);
        user.setEmail(normalizedEmail);
        user.setRole(normalizedRole);

        if (shouldSetDemoPassword || shouldUpgradePlainDemoPassword) {
            user.setMotDePasse(passwordEncoder.encode(motDePasse));
        }

        utilisateurRepository.save(user);
        LOGGER.info("{} compte demo {} ({})", isNew ? "Creation" : "Mise a jour", normalizedEmail, normalizedRole);
    }

    private String normalizeNamePart(String value) {
        String normalized = value == null ? "" : value.trim().replaceAll("\\s+", " ");
        if (normalized.isBlank()) {
            throw new BusinessException("Les informations du compte sont incompletes");
        }
        return normalized;
    }

    private String normalizeEmail(String email) {
        String normalized = email == null ? "" : email.trim().toLowerCase();
        if (normalized.isBlank()) {
            throw new BusinessException("L'email est obligatoire");
        }
        return normalized;
    }

    private String buildDisplayName(String prenom, String nom) {
        return (prenom + " " + nom).trim();
    }

    private Set<Competence> resolveCompetences(Set<Long> competenceIds) {
        if (competenceIds == null || competenceIds.isEmpty()) {
            return Set.of();
        }

        return competenceIds.stream()
                .map(id -> competenceRepository.findById(id)
                        .orElseThrow(() -> new ResourceNotFoundException("Competence introuvable : " + id)))
                .collect(Collectors.toSet());
    }

    private boolean isPasswordStrong(String password) {
        return password != null && password.matches("^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d).{8,}$");
    }

    private void validateStrongPassword(String password) {
        if (!isPasswordStrong(password)) {
            throw new BusinessException("Le mot de passe doit contenir au moins 8 caracteres, une majuscule, une minuscule et un chiffre");
        }
    }

    private void upgradeLegacyPasswordIfNeeded(Utilisateur user, String rawPassword) {
        String storedPassword = user.getMotDePasse();

        if (storedPassword == null || storedPassword.isBlank()) {
            return;
        }

        if (PasswordHashUtils.isBcryptEncoded(storedPassword)) {
            return;
        }

        if (!Objects.equals(storedPassword, rawPassword)) {
            return;
        }

        user.setMotDePasse(passwordEncoder.encode(rawPassword));
        utilisateurRepository.save(user);
        LOGGER.info("Mot de passe legacy migre vers BCrypt pour {}", user.getEmail());
    }

    private void authenticateCredentials(String normalizedEmail, String rawPassword) {
        try {
            authenticationManager.authenticate(
                    new UsernamePasswordAuthenticationToken(normalizedEmail, rawPassword));
        } catch (BadCredentialsException exception) {
            LOGGER.warn("Connexion echouee — mot de passe invalide pour {}", normalizedEmail);
            throw new BusinessException("Email ou mot de passe incorrect");
        }
    }

    private String normalizeRawPassword(String password) {
        if (password == null) {
            throw new BusinessException("Le mot de passe est obligatoire");
        }
        return password;
    }

    private boolean passwordMatches(String rawPassword, String storedPassword) {
        if (storedPassword == null || storedPassword.isBlank()) {
            return false;
        }

        if (PasswordHashUtils.isBcryptEncoded(storedPassword)) {
            return passwordEncoder.matches(rawPassword, storedPassword);
        }

        return Objects.equals(storedPassword, rawPassword);
    }

    private String generateResetToken() {
        byte[] tokenBytes = new byte[32];
        new java.security.SecureRandom().nextBytes(tokenBytes);
        return TOKEN_ENCODER.encodeToString(tokenBytes);
    }

    private String hashToken(String rawToken) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            return HexFormat.of().formatHex(digest.digest(rawToken.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException exception) {
            throw new IllegalStateException("SHA-256 indisponible", exception);
        }
    }

    private String buildResetLink(String rawToken) {
        String separator = resetPasswordUrl.contains("?") ? "&" : "?";
        return resetPasswordUrl + separator + "token=" + URLEncoder.encode(rawToken, StandardCharsets.UTF_8);
    }

    private PasswordResetToken resolveActiveResetToken(String rawToken) {
        String normalizedToken = rawToken == null ? "" : rawToken.trim();

        if (normalizedToken.isBlank()) {
            throw new BusinessException("Le lien de reinitialisation est invalide.");
        }

        PasswordResetToken resetToken = passwordResetTokenRepository.findByTokenHash(hashToken(normalizedToken))
                .orElseThrow(() -> new BusinessException("Le lien de reinitialisation est invalide."));

        if (resetToken.getUsedAt() != null) {
            throw new BusinessException("Ce lien de reinitialisation a deja ete utilise.");
        }

        if (resetToken.getExpiresAt().isBefore(LocalDateTime.now())) {
            throw new BusinessException("Ce lien de reinitialisation a expire.");
        }

        return resetToken;
    }

    private void syncDemoCollaborateur(String nom, String prenom, String email, int experienceAnnees, boolean disponible) {
        Collaborateur collaborateur = collaborateurRepository.findByEmailIgnoreCase(email)
                .orElseGet(() -> Collaborateur.builder().email(email).build());

        boolean isNew = collaborateur.getId() == null;
        boolean hasChanged = isNew
                || !Objects.equals(collaborateur.getNom(), nom)
                || !Objects.equals(collaborateur.getPrenom(), prenom)
                || !Objects.equals(collaborateur.getEmail(), email)
                || collaborateur.getExperienceAnnees() != experienceAnnees
                || collaborateur.isDisponible() != disponible;

        if (!hasChanged) {
            return;
        }

        collaborateur.setNom(nom);
        collaborateur.setPrenom(prenom);
        collaborateur.setEmail(email);
        collaborateur.setExperienceAnnees(experienceAnnees);
        collaborateur.setDisponible(disponible);

        collaborateurRepository.save(collaborateur);
        String action = isNew ? "✅ Collaborateur cree : " : "♻️ Collaborateur mis a jour : ";
        System.out.println(action + email + " (COLLAB)");
    }

    private void syncDemoPlanningData(String email) {
        collaborateurRepository.findByEmailIgnoreCase(email).ifPresent(collaborateur -> {
            List<Projet> projetsReference = affectationRepository.findByCollaborateurId(collaborateur.getId())
                    .stream()
                    .map(Affectation::getProjet)
                    .distinct()
                    .toList();

            if (projetsReference.isEmpty()) {
                projetsReference = projetRepository.findAll().stream().limit(2).toList();
            }

            Projet projetPrincipal = projetsReference.isEmpty() ? null : projetsReference.get(0);
            Projet projetSecondaire = projetsReference.size() > 1 ? projetsReference.get(1) : projetPrincipal;
            LocalDate today = LocalDate.now();

            syncDemoTask(
                    collaborateur,
                    projetPrincipal,
                    "Preparation du sprint collaborateur",
                    "Finaliser le decoupage des user stories et confirmer les dependances de livraison.",
                    today.plusDays(3),
                    "EN_COURS",
                    "HAUTE");

            syncDemoTask(
                    collaborateur,
                    projetSecondaire,
                    "Revue fonctionnelle avec le manager",
                    "Valider les points de controle metier et mettre a jour les livrables attendus.",
                    today.plusDays(8),
                    "A_FAIRE",
                    "MOYENNE");

            syncDemoTask(
                    collaborateur,
                    projetPrincipal,
                    "Tests de validation finale",
                    "Executer les scenarios critiques avant le jalon de cloture de mission.",
                    today.plusDays(15),
                    "A_FAIRE",
                    "BASSE");

            syncDemoConge(
                    collaborateur,
                    "Disponibilite reduite",
                    "Disponibilite partielle",
                    today.plusDays(1),
                    today.plusDays(2),
                    "PARTIELLE");

            syncDemoConge(
                    collaborateur,
                    "Conge planifie",
                    "Absence planifiee",
                    today.plusDays(12),
                    today.plusDays(14),
                    "INDISPONIBLE");
        });
    }

    private void syncDemoTask(Collaborateur collaborateur, Projet projet, String titre, String description,
            LocalDate dateEcheance, String statut, String priorite) {
        Tache tache = tacheRepository.findByCollaborateurIdAndTitreIgnoreCase(collaborateur.getId(), titre)
                .orElseGet(() -> Tache.builder().collaborateur(collaborateur).titre(titre).build());

        tache.setCollaborateur(collaborateur);
        tache.setProjet(projet);
        tache.setTitre(titre);
        tache.setDescription(description);
        tache.setDateEcheance(dateEcheance);
        tache.setStatut(statut);
        tache.setPriorite(priorite);

        tacheRepository.save(tache);
    }

    private void syncDemoConge(Collaborateur collaborateur, String libelle, String type,
            LocalDate dateDebut, LocalDate dateFin, String impactDisponibilite) {
        Conge conge = congeRepository.findByCollaborateurIdAndLibelleIgnoreCase(collaborateur.getId(), libelle)
                .orElseGet(() -> Conge.builder().collaborateur(collaborateur).libelle(libelle).build());

        conge.setCollaborateur(collaborateur);
        conge.setLibelle(libelle);
        conge.setType(type);
        conge.setDateDebut(dateDebut);
        conge.setDateFin(dateFin);
        conge.setImpactDisponibilite(impactDisponibilite);

        congeRepository.save(conge);
    }

    private void ensureUtilisateurRoleConstraint() {
        jdbcTemplate.execute("""
                DO $$
                DECLARE constraint_record RECORD;
                BEGIN
                    FOR constraint_record IN
                        SELECT con.conname
                        FROM pg_constraint con
                        JOIN pg_class rel ON rel.oid = con.conrelid
                        JOIN pg_namespace nsp ON nsp.oid = con.connamespace
                        WHERE rel.relname = 'utilisateurs'
                          AND nsp.nspname = current_schema()
                          AND con.contype = 'c'
                          AND pg_get_constraintdef(con.oid) ILIKE '%role%'
                    LOOP
                        EXECUTE format('ALTER TABLE utilisateurs DROP CONSTRAINT %I', constraint_record.conname);
                    END LOOP;

                    ALTER TABLE utilisateurs
                        ADD CONSTRAINT utilisateurs_role_check
                        CHECK (role IN ('ADMIN', 'MANAGER', 'COLLAB'));
                EXCEPTION
                    WHEN duplicate_object THEN NULL;
                END $$;
                """);
    }

    private UtilisateurResponse toUtilisateurResponse(Utilisateur user) {
        return UtilisateurResponse.builder()
                .id(user.getId())
                .nom(user.getNom())
                .email(user.getEmail())
                .role(user.getRole())
                .build();
    }

    private int rolePriority(String role) {
        return switch (role) {
            case "ADMIN" -> 0;
            case "MANAGER" -> 1;
            case "COLLAB" -> 2;
            default -> 3;
        };
    }
}