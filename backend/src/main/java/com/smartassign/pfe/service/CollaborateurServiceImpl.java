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

import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.smartassign.pfe.dto.CollaborateurRequest;
import com.smartassign.pfe.dto.CollaborateurResponse;
import com.smartassign.pfe.dto.CompetenceResponse;
import com.smartassign.pfe.entity.Collaborateur;
import com.smartassign.pfe.entity.Competence;
import com.smartassign.pfe.entity.Utilisateur;
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

    private static final String DEFAULT_ROLE = "COLLAB";
    private static final String EMAIL_DOMAIN = "smartassign.tn";
    private static final String PASSWORD_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789@#$%!";
    private static final int GENERATED_PASSWORD_LENGTH = 12;
    private static final SecureRandom SECURE_RANDOM = new SecureRandom();

    private final CollaborateurRepository collaborateurRepository;
    private final CompetenceRepository competenceRepository;
    private final UtilisateurRepository utilisateurRepository;
    private final AffectationRepository affectationRepository;
    private final TacheRepository tacheRepository;
    private final CongeRepository congeRepository;
    private final PasswordResetTokenRepository passwordResetTokenRepository;
    private final PasswordEncoder passwordEncoder;

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
        String generatedEmail = generateUniqueEmail(normalizedPrenom, normalizedNom, null, null);

        Collaborateur collaborateur = Collaborateur.builder()
                .nom(normalizedNom)
                .prenom(normalizedPrenom)
                .email(generatedEmail)
                .role(normalizedRole)
                .experienceAnnees(request.getExperienceAnnees())
                .disponible(request.isDisponible())
                .competences(resolveCompetences(request.getCompetenceIds()))
                .build();

        Collaborateur saved = collaborateurRepository.save(collaborateur);
        String generatedPassword = syncUtilisateur(saved, null);
        return toResponse(saved, generatedPassword);
    }

    public CollaborateurResponse update(Long id, CollaborateurRequest request) {
        Collaborateur collaborateur = findCollaborateurById(id);

        String previousEmail = collaborateur.getEmail();
        Long currentUtilisateurId = utilisateurRepository.findByEmailIgnoreCase(previousEmail)
                .map(Utilisateur::getId)
                .orElse(null);
        String normalizedNom = normalizeName(request.getNom());
        String normalizedPrenom = normalizeName(request.getPrenom());
        String normalizedRole = normalizeRole(request.getRole() == null ? collaborateur.getRole() : request.getRole());
        String generatedEmail = generateUniqueEmail(normalizedPrenom, normalizedNom, collaborateur.getId(), currentUtilisateurId);

        collaborateur.setNom(normalizedNom);
        collaborateur.setPrenom(normalizedPrenom);
        collaborateur.setEmail(generatedEmail);
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
}