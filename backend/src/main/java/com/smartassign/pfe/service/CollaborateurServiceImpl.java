package com.smartassign.pfe.service;

import java.text.Normalizer;
import java.security.SecureRandom;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;
import java.util.stream.Collectors;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import jakarta.mail.internet.MimeMessage;

import com.smartassign.pfe.dto.CollaborateurRequest;
import com.smartassign.pfe.dto.CollaborateurResponse;
import com.smartassign.pfe.dto.CompetenceResponse;
import com.smartassign.pfe.entity.Collaborateur;
import com.smartassign.pfe.entity.Competence;
import com.smartassign.pfe.entity.Utilisateur;
import com.smartassign.pfe.exception.DuplicateEmailException;
import com.smartassign.pfe.exception.ResourceNotFoundException;
import com.smartassign.pfe.repository.AffectationRepository;
import com.smartassign.pfe.repository.CollaborateurRepository;
import com.smartassign.pfe.repository.CompetenceRepository;
import com.smartassign.pfe.repository.CongeRepository;
import com.smartassign.pfe.repository.PasswordResetTokenRepository;
import com.smartassign.pfe.repository.TacheRepository;
import com.smartassign.pfe.repository.UtilisateurRepository;

import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
@Transactional
public class CollaborateurServiceImpl implements CollaborateurService {

    private static final Logger LOGGER = LoggerFactory.getLogger(CollaborateurServiceImpl.class);
    private static final String DEFAULT_ROLE = "COLLAB";
    private static final String EMAIL_DOMAIN = "smartassign.tn";
    private static final String PASSWORD_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789@#$%!";
    private static final int GENERATED_PASSWORD_LENGTH = 12;
    private static final SecureRandom SECURE_RANDOM = new SecureRandom();

    @Value("${spring.mail.username}")
    private String adminEmail;

    private final CollaborateurRepository collaborateurRepository;
    private final CompetenceRepository competenceRepository;
    private final UtilisateurRepository utilisateurRepository;
    private final AffectationRepository affectationRepository;
    private final TacheRepository tacheRepository;
    private final CongeRepository congeRepository;
    private final PasswordResetTokenRepository passwordResetTokenRepository;
    private final PasswordEncoder passwordEncoder;
    private final JavaMailSender javaMailSender;

    @Transactional(readOnly = true)
    public List<CollaborateurResponse> getAll() {
        return collaborateurRepository.findAll()
                .stream()
                .map(this::toResponse)
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public CollaborateurResponse getById(Long id) {
        return toResponse(findCollaborateurById(id));
    }

    @Transactional(readOnly = true)
    public CollaborateurResponse getByEmail(String email) {
        String normalizedEmail = email == null ? "" : email.trim();
        return toResponse(findCollaborateurByEmail(normalizedEmail));
    }

    public CollaborateurResponse create(CollaborateurRequest request) {
        String normalizedNom = normalizeName(request.getNom());
        String normalizedPrenom = normalizeName(request.getPrenom());
        String normalizedRole = normalizeRole(request.getRole());
        String normalizedEmail = normalizeEmail(request.getEmail());
        
        // Vérifier que l'email n'existe pas déjà
        if (collaborateurRepository.findByEmailIgnoreCase(normalizedEmail).isPresent()) {
            throw new DuplicateEmailException("Cet email est déjà utilisé par un collaborateur.");
        }
        
        if (utilisateurRepository.findByEmailIgnoreCase(normalizedEmail).isPresent()) {
            throw new DuplicateEmailException("Cet email est déjà utilisé.");
        }

        Collaborateur collaborateur = Collaborateur.builder()
                .nom(normalizedNom)
                .prenom(normalizedPrenom)
                .email(normalizedEmail)
                .role(normalizedRole)
                .experienceAnnees(request.getExperienceAnnees())
                .disponible(request.isDisponible())
                .competences(resolveCompetences(request.getCompetenceIds()))
                .build();

        Collaborateur saved = collaborateurRepository.save(collaborateur);
        String generatedPassword = syncUtilisateur(saved, null);
        
        if (generatedPassword != null && !generatedPassword.isBlank()) {
            sendWelcomeEmail(saved, generatedPassword);
        }
        
        return toResponse(saved, generatedPassword);
    }

    public CollaborateurResponse update(Long id, CollaborateurRequest request) {
        Collaborateur collaborateur = findCollaborateurById(id);

        String previousEmail = collaborateur.getEmail();
        String normalizedNom    = normalizeName(request.getNom());
        String normalizedPrenom = normalizeName(request.getPrenom());
        String normalizedRole   = normalizeRole(request.getRole() == null ? collaborateur.getRole() : request.getRole());

        // Utiliser l'email saisi par l'admin (pas de génération automatique)
        String newEmail = normalizeEmail(request.getEmail());

        // Vérifier les doublons (sauf si c'est le même email)
        if (!newEmail.equalsIgnoreCase(previousEmail)) {
            if (collaborateurRepository.findByEmailIgnoreCase(newEmail)
                    .filter(other -> !Objects.equals(other.getId(), id))
                    .isPresent()) {
                throw new DuplicateEmailException("Cet email est déjà utilisé par un collaborateur.");
            }
            if (utilisateurRepository.findByEmailIgnoreCase(newEmail)
                    .filter(other -> {
                        Long prevUserId = utilisateurRepository.findByEmailIgnoreCase(previousEmail)
                                .map(Utilisateur::getId).orElse(null);
                        return !Objects.equals(other.getId(), prevUserId);
                    }).isPresent()) {
                throw new DuplicateEmailException("Cet email est déjà utilisé.");
            }
        }

        collaborateur.setNom(normalizedNom);
        collaborateur.setPrenom(normalizedPrenom);
        collaborateur.setEmail(newEmail);
        collaborateur.setRole(normalizedRole);
        collaborateur.setExperienceAnnees(request.getExperienceAnnees());
        collaborateur.setDisponible(request.isDisponible());
        collaborateur.setCompetences(resolveCompetences(request.getCompetenceIds()));

        Collaborateur saved = collaborateurRepository.save(collaborateur);
        syncUtilisateur(saved, previousEmail);
        return toResponse(saved);
    }

    public CollaborateurResponse updateRole(Long id, String role) {
        Collaborateur collaborateur = findCollaborateurById(id);

        collaborateur.setRole(normalizeRole(role));
        Collaborateur saved = collaborateurRepository.save(collaborateur);
        syncUtilisateur(saved, saved.getEmail());
        return toResponse(saved);
    }

    public CollaborateurResponse toggleDisponibilite(Long id) {
        Collaborateur collaborateur = findCollaborateurById(id);

        collaborateur.setDisponible(!collaborateur.isDisponible());
        return toResponse(collaborateurRepository.save(collaborateur));
    }

    public void delete(Long id) {
        Collaborateur collaborateur = findCollaborateurById(id);

        // Remove FK-dependent records before deleting the collaborateur
        affectationRepository.deleteAll(affectationRepository.findByCollaborateurId(id));
        tacheRepository.deleteAll(tacheRepository.findByCollaborateurIdOrderByDateEcheanceAsc(id));
        congeRepository.deleteAll(congeRepository.findByCollaborateurIdOrderByDateDebutAsc(id));

        utilisateurRepository.findByEmailIgnoreCase(collaborateur.getEmail())
                .ifPresent(utilisateur -> {
                    passwordResetTokenRepository.deleteByUtilisateur_Id(utilisateur.getId());
                    utilisateurRepository.delete(utilisateur);
                });
        collaborateurRepository.delete(collaborateur);
    }

    @Transactional(readOnly = true)
    public List<CollaborateurResponse> getDisponibles() {
        return collaborateurRepository.findByDisponibleTrue()
                .stream()
                .map(this::toResponse)
                .collect(Collectors.toList());
    }

    public CollaborateurResponse toResponse(Collaborateur collaborateur) {
        return toResponse(collaborateur, null);
        }

        public CollaborateurResponse toResponse(Collaborateur collaborateur, String generatedPassword) {
        Set<CompetenceResponse> competences = collaborateur.getCompetences().stream()
                .map(comp -> new CompetenceResponse(comp.getId(), comp.getNom()))
                .collect(Collectors.toSet());

        return CollaborateurResponse.builder()
                .id(collaborateur.getId())
                .nom(collaborateur.getNom())
                .prenom(collaborateur.getPrenom())
                .email(collaborateur.getEmail())
                .role(normalizeRole(collaborateur.getRole()))
                .motDePasseGenere(generatedPassword)
                .experienceAnnees(collaborateur.getExperienceAnnees())
                .disponible(collaborateur.isDisponible())
                .competences(competences)
                .build();
    }

    private Set<Competence> resolveCompetences(Set<Long> ids) {
        if (ids == null || ids.isEmpty()) {
            return new HashSet<>();
        }

        return ids.stream()
            .map(this::findCompetenceById)
                .collect(Collectors.toCollection(HashSet::new));
    }

        private Collaborateur findCollaborateurById(Long id) {
        return collaborateurRepository.findById(id)
            .orElseThrow(() -> new ResourceNotFoundException("Collaborateur introuvable : " + id));
        }

        private Collaborateur findCollaborateurByEmail(String email) {
        return collaborateurRepository.findByEmailIgnoreCase(email)
            .orElseThrow(() -> new ResourceNotFoundException("Collaborateur introuvable pour l'email : " + email));
        }

        private Competence findCompetenceById(Long id) {
        return competenceRepository.findById(id)
            .orElseThrow(() -> new ResourceNotFoundException("Compétence introuvable : " + id));
        }

    private String syncUtilisateur(Collaborateur collaborateur, String previousEmail) {
        Utilisateur utilisateur = findUtilisateurForSync(previousEmail, collaborateur.getEmail())
                .orElseGet(() -> Utilisateur.builder().build());
        String generatedPassword = null;

        utilisateur.setNom(buildDisplayName(collaborateur.getPrenom(), collaborateur.getNom()));
        utilisateur.setEmail(collaborateur.getEmail());
        utilisateur.setRole(normalizeRole(collaborateur.getRole()));

        if (utilisateur.getMotDePasse() == null || utilisateur.getMotDePasse().isBlank()) {
            generatedPassword = generatePassword();
            utilisateur.setMotDePasse(passwordEncoder.encode(generatedPassword));
        } else if (!isPasswordEncoded(utilisateur.getMotDePasse())) {
            utilisateur.setMotDePasse(passwordEncoder.encode(utilisateur.getMotDePasse()));
        }

        utilisateurRepository.save(utilisateur);
        return generatedPassword;
    }

    private Optional<Utilisateur> findUtilisateurForSync(String previousEmail, String currentEmail) {
        if (previousEmail != null && !previousEmail.isBlank()) {
            Optional<Utilisateur> previousUtilisateur = utilisateurRepository.findByEmailIgnoreCase(previousEmail.trim());
            if (previousUtilisateur.isPresent()) {
                return previousUtilisateur;
            }
        }

        if (currentEmail == null || currentEmail.isBlank()) {
            return Optional.empty();
        }

        return utilisateurRepository.findByEmailIgnoreCase(currentEmail.trim());
    }

    private String generateUniqueEmail(String prenom, String nom, Long currentCollaborateurId, Long currentUtilisateurId) {
        String localBase = buildEmailLocalPart(prenom, nom);
        int suffix = 0;

        while (true) {
            String localPart = suffix == 0 ? localBase : localBase + suffix;
            String candidate = localPart + "@" + EMAIL_DOMAIN;

            if (!isEmailUsedByAnotherCollaborateur(candidate, currentCollaborateurId)
                    && !isEmailUsedByAnotherUtilisateur(candidate, currentUtilisateurId)) {
                return candidate;
            }

            suffix++;
        }
    }

    private boolean isEmailUsedByAnotherCollaborateur(String email, Long currentCollaborateurId) {
        return collaborateurRepository.findByEmailIgnoreCase(email)
                .filter(collaborateur -> !Objects.equals(collaborateur.getId(), currentCollaborateurId))
                .isPresent();
    }

    private boolean isEmailUsedByAnotherUtilisateur(String email, Long currentUtilisateurId) {
        return utilisateurRepository.findByEmailIgnoreCase(email)
                .filter(utilisateur -> !Objects.equals(utilisateur.getId(), currentUtilisateurId))
                .isPresent();
    }

    private String buildEmailLocalPart(String prenom, String nom) {
        String prenomSlug = slugify(prenom);
        String nomSlug = slugify(nom);

        if (!prenomSlug.isBlank() && !nomSlug.isBlank()) {
            return prenomSlug + "." + nomSlug;
        }

        if (!nomSlug.isBlank()) {
            return nomSlug;
        }

        if (!prenomSlug.isBlank()) {
            return prenomSlug;
        }

        return "utilisateur";
    }

    private String slugify(String value) {
        if (value == null) {
            return "";
        }

        return Normalizer.normalize(value.trim(), Normalizer.Form.NFD)
                .replaceAll("\\p{M}+", "")
                .toLowerCase(Locale.ROOT)
                .replaceAll("[^a-z0-9]+", ".")
                .replaceAll("\\.+", ".")
                .replaceAll("^\\.|\\.$", "");
    }

    private String normalizeName(String value) {
        return value == null ? "" : value.trim();
    }

    private String buildDisplayName(String prenom, String nom) {
        return (normalizeName(prenom) + " " + normalizeName(nom)).trim();
    }

    private String normalizeRole(String role) {
        String normalizedRole = role == null ? DEFAULT_ROLE : role.trim().toUpperCase(Locale.ROOT);

        if (normalizedRole.contains("ADMIN")) {
            return "ADMIN";
        }

        if (normalizedRole.contains("MANAGER") || normalizedRole.contains("CHEF")) {
            return "MANAGER";
        }

        return DEFAULT_ROLE;
    }

    private String generatePassword() {
        StringBuilder password = new StringBuilder(GENERATED_PASSWORD_LENGTH);

        for (int index = 0; index < GENERATED_PASSWORD_LENGTH; index++) {
            int randomIndex = SECURE_RANDOM.nextInt(PASSWORD_CHARS.length());
            password.append(PASSWORD_CHARS.charAt(randomIndex));
        }

        return password.toString();
    }

    private boolean isPasswordEncoded(String password) {
        return password != null
                && (password.startsWith("$2a$") || password.startsWith("$2b$") || password.startsWith("$2y$"));
    }

    private void sendWelcomeEmail(Collaborateur collaborateur, String generatedPassword) {
        // 1. Email au collaborateur
        sendEmailToCollaborateur(collaborateur, generatedPassword);
        // 2. Copie a l'admin (au cas ou l'email du collaborateur bounce)
        sendCopyToAdmin(collaborateur, generatedPassword);
    }

    private void sendEmailToCollaborateur(Collaborateur collaborateur, String generatedPassword) {
        try {
            MimeMessage message = javaMailSender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(message, true, "UTF-8");
            helper.setFrom("SmartAssign <marambenrajab1@gmail.com>");
            helper.setTo(collaborateur.getEmail());
            helper.setSubject("Bienvenue sur SmartAssign - vos identifiants");

            String html = String.format(
                "<div style='font-family:Arial,sans-serif;max-width:520px;margin:auto;border:1px solid #e2e8f0;border-radius:10px;overflow:hidden'>" +
                "<div style='background:#1e293b;padding:24px;text-align:center'>" +
                "  <h1 style='color:#fff;margin:0;font-size:22px'>SmartAssign</h1>" +
                "</div>" +
                "<div style='padding:32px'>" +
                "  <h2 style='color:#1e293b;margin-top:0'>Bienvenue, %s %s !</h2>" +
                "  <p style='color:#475569'>Votre compte a \u00e9t\u00e9 cr\u00e9\u00e9 avec succ\u00e8s. Voici vos identifiants :</p>" +
                "  <table style='background:#f8fafc;border-radius:8px;padding:16px;width:100%%;border-collapse:collapse'>" +
                "    <tr><td style='color:#64748b;padding:6px 0'>Email</td>" +
                "        <td style='font-weight:bold;color:#1e293b'>%s</td></tr>" +
                "    <tr><td style='color:#64748b;padding:6px 0'>Mot de passe temporaire</td>" +
                "        <td style='font-weight:bold;color:#7c3aed;font-family:monospace;font-size:15px'>%s</td></tr>" +
                "  </table>" +
                "  <p style='color:#dc2626;margin-top:20px;font-size:13px'>" +
                "    Changez ce mot de passe d\u00e8s votre premi\u00e8re connexion." +
                "  </p>" +
                "  <p style='color:#475569'>Connectez-vous sur <strong>http://localhost:4200</strong></p>" +
                "</div>" +
                "<div style='background:#f1f5f9;padding:16px;text-align:center;font-size:12px;color:#94a3b8'>" +
                "  L'\u00e9quipe SmartAssign" +
                "</div></div>",
                collaborateur.getPrenom(), collaborateur.getNom(),
                collaborateur.getEmail(), generatedPassword
            );

            helper.setText(html, true);
            javaMailSender.send(message);
            LOGGER.info("[EMAIL] Envoi reussi vers : {}", collaborateur.getEmail());
        } catch (Exception e) {
            LOGGER.error("[EMAIL] Echec envoi vers {} : {}", collaborateur.getEmail(), e.getMessage(), e);
        }
    }

    private void sendCopyToAdmin(Collaborateur collaborateur, String generatedPassword) {
        try {
            MimeMessage message = javaMailSender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(message, true, "UTF-8");
            helper.setFrom("SmartAssign <marambenrajab1@gmail.com>");
            helper.setTo(adminEmail);
            helper.setSubject("[Copie Admin] Compte cree : " + collaborateur.getPrenom() + " " + collaborateur.getNom());

            String html = String.format(
                "<div style='font-family:Arial,sans-serif;max-width:520px;margin:auto;border:1px solid #e2e8f0;border-radius:10px;overflow:hidden'>" +
                "<div style='background:#0f172a;padding:24px;text-align:center'>" +
                "  <h1 style='color:#fff;margin:0;font-size:18px'>SmartAssign - Copie Admin</h1>" +
                "</div>" +
                "<div style='padding:32px'>" +
                "  <p style='color:#475569'>Un nouveau compte a \u00e9t\u00e9 cr\u00e9\u00e9 pour :</p>" +
                "  <table style='background:#f8fafc;border-radius:8px;padding:16px;width:100%%;border-collapse:collapse'>" +
                "    <tr><td style='color:#64748b;padding:6px 0'>Nom</td>" +
                "        <td style='font-weight:bold;color:#1e293b'>%s %s</td></tr>" +
                "    <tr><td style='color:#64748b;padding:6px 0'>Email</td>" +
                "        <td style='font-weight:bold;color:#1e293b'>%s</td></tr>" +
                "    <tr><td style='color:#64748b;padding:6px 0'>Mot de passe temporaire</td>" +
                "        <td style='font-weight:bold;color:#7c3aed;font-family:monospace;font-size:15px'>%s</td></tr>" +
                "  </table>" +
                "  <p style='color:#dc2626;font-size:13px;margin-top:16px'>" +
                "    Si l'email du collaborateur a \u00e9chou\u00e9 (bounce), transmettez-lui ces identifiants manuellement." +
                "  </p>" +
                "</div></div>",
                collaborateur.getPrenom(), collaborateur.getNom(),
                collaborateur.getEmail(), generatedPassword
            );

            helper.setText(html, true);
            javaMailSender.send(message);
            LOGGER.info("[EMAIL] Copie admin envoyee a : {}", adminEmail);
        } catch (Exception e) {
            LOGGER.error("[EMAIL] Echec copie admin : {}", e.getMessage(), e);
        }
    }

    private String normalizeEmail(String email) {
        return email == null ? "" : email.trim().toLowerCase(Locale.ROOT);
    }
}