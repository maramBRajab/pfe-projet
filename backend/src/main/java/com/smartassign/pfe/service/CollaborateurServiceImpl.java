package com.smartassign.pfe.service;

import java.text.Normalizer;
import java.security.SecureRandom;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.LocalDateTime;
import java.util.Base64;
import java.util.HexFormat;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;
import java.util.stream.Collectors;
import java.util.regex.Pattern;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.beans.factory.annotation.Value;

import com.smartassign.pfe.dto.CollaborateurRequest;
import com.smartassign.pfe.dto.CollaborateurResponse;
import com.smartassign.pfe.dto.CompetenceResponse;
import com.smartassign.pfe.dto.MesProjetsDto;
import com.smartassign.pfe.entity.Collaborateur;
import com.smartassign.pfe.entity.Competence;
import com.smartassign.pfe.entity.DisponibiliteUtilisateur;
import com.smartassign.pfe.entity.Jalon;
import com.smartassign.pfe.entity.Tache;
import com.smartassign.pfe.entity.Utilisateur;
import com.smartassign.pfe.exception.BusinessException;
import com.smartassign.pfe.exception.DuplicateEmailException;
import com.smartassign.pfe.exception.ResourceNotFoundException;
import com.smartassign.pfe.service.CredentialsMailService.CredentialsMailKind;
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

import lombok.RequiredArgsConstructor;
import com.smartassign.pfe.config.AppMailProperties;

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
    private static final Base64.Encoder TOKEN_ENCODER = Base64.getUrlEncoder().withoutPadding();
    private static final Pattern EMAIL_PATTERN = Pattern.compile("^[a-z0-9._%+-]+@[a-z0-9.-]+\\.[a-z]{2,}$", Pattern.CASE_INSENSITIVE);
    private static final Set<String> ALLOWED_EMAIL_DOMAINS = Set.of(
        "gmail.com",
        "outlook.com",
        "hotmail.com",
        "yahoo.com",
        "entreprise.com"
    );

    private final CollaborateurRepository collaborateurRepository;
    private final CompetenceRepository competenceRepository;
    private final UtilisateurRepository utilisateurRepository;
    private final AffectationRepository affectationRepository;
    private final TacheRepository tacheRepository;
    private final JalonRepository jalonRepository;
    private final DisponibiliteUtilisateurRepository disponibiliteUtilisateurRepository;
    private final EmailVerificationTokenRepository emailVerificationTokenRepository;
    private final CongeRepository congeRepository;
    private final PasswordResetTokenRepository passwordResetTokenRepository;
    private final PasswordEncoder passwordEncoder;
    private final CredentialsMailService credentialsMailService;

    @Value("${app.email-verification.token-expiration-minutes:1440}")
    private long emailVerificationExpirationMinutes;

    @Value("${app.email-verification.url:http://localhost:4200/verify-email}")
    private String emailVerificationUrl;

    @Value("${app.email-verification.require-delivery:true}")
    private boolean requireEmailDelivery;

    @Value("${app.email-verification.check-mx-records:true}")
    private boolean checkMxRecords;

    private final EmailDomainValidatorService emailDomainValidatorService;
    private final AppMailProperties appMailProperties;

    public List<CollaborateurResponse> getAll() {
        syncMissingCollaborateursFromUtilisateurs();
        return collaborateurRepository.findAll()
                .stream()
                .filter(c -> "COLLAB".equalsIgnoreCase(c.getRole()))
                .filter(new java.util.function.Predicate<Collaborateur>() {
                    private final Set<String> seen = new HashSet<>();
                    public boolean test(Collaborateur c) {
                        String email = c.getEmail() == null ? "" : c.getEmail().trim().toLowerCase();
                        return seen.add(email);
                    }
                })
                .map(this::toResponse)
                .collect(Collectors.toList());
    }

    @Transactional
    public List<CollaborateurResponse> getAllUsers() {
        syncMissingCollaborateursFromUtilisateurs(true);
        return collaborateurRepository.findAll()
                .stream()
                .filter(new java.util.function.Predicate<Collaborateur>() {
                    private final Set<String> seen = new HashSet<>();
                    public boolean test(Collaborateur c) {
                        String email = c.getEmail() == null ? "" : c.getEmail().trim().toLowerCase();
                        return seen.add(email);
                    }
                })
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
        String normalizedEmail = normalizeAndValidateEmail(request.getEmail());

        // Vérification préalable du domaine email (avant toute persistance)
        if (checkMxRecords && appMailProperties.isEnabled()) {
            emailDomainValidatorService.assertEmailDeliverable(normalizedEmail);
        }

        // Vérifier que l'email n'existe pas déjà
        if (collaborateurRepository.findByEmailIgnoreCase(normalizedEmail).isPresent()) {
            throw new DuplicateEmailException("Cette adresse email est déjà utilisée.");
        }
        
        if (utilisateurRepository.findByEmailIgnoreCase(normalizedEmail).isPresent()) {
            throw new DuplicateEmailException("Cette adresse email est déjà utilisée.");
        }

        Collaborateur collaborateur = Collaborateur.builder()
                .nom(normalizedNom)
                .prenom(normalizedPrenom)
                .email(normalizedEmail)
                .telephone(normalizeText(request.getTelephone()))
                .photoUrl(normalizeText(request.getPhotoUrl()))
                .role(normalizedRole)
            .departement(normalizeText(request.getDepartement()))
                .experienceAnnees(request.getExperienceAnnees())
                .disponible(request.isDisponible())
                .competences(resolveCompetences(request.getCompetenceIds()))
                .build();

        Collaborateur saved = collaborateurRepository.save(collaborateur);
        UtilisateurSyncResult syncResult = syncUtilisateur(saved, null, true);
        String generatedPassword = syncResult.generatedPassword();

        // Envoi de l'email de vérification en priorité
        EmailDeliveryStatus verificationStatus = sendVerificationEmail(syncResult.utilisateur(), saved);

        // Si la délivrance est requise et que l'envoi a échoué → rollback complet (@Transactional)
        if (requireEmailDelivery && appMailProperties.isEnabled() && !verificationStatus.sent()) {
            throw new BusinessException(
                "Impossible de créer l'utilisateur. L'adresse email semble invalide ou ne peut pas recevoir d'emails."
            );
        }

        // Envoi des identifiants (secondaire — pas de rollback sur échec)
        EmailDeliveryStatus emailStatus = EmailDeliveryStatus.notSent();
        if (generatedPassword != null && !generatedPassword.isBlank()) {
            emailStatus = sendWelcomeEmail(saved, generatedPassword);
        }

        return toResponse(saved, generatedPassword, emailStatus, verificationStatus);
    }

    public CollaborateurResponse update(Long id, CollaborateurRequest request) {
        Collaborateur collaborateur = findCollaborateurById(id);

        String previousEmail = collaborateur.getEmail();
        String normalizedNom    = normalizeName(request.getNom());
        String normalizedPrenom = normalizeName(request.getPrenom());
        String normalizedRole   = normalizeRole(request.getRole() == null ? collaborateur.getRole() : request.getRole());

        // Utiliser l'email saisi par l'admin (pas de génération automatique)
        String newEmail = normalizeAndValidateEmail(request.getEmail());

        // Vérifier les doublons (sauf si c'est le même email)
        if (!newEmail.equalsIgnoreCase(previousEmail)) {
            if (collaborateurRepository.findByEmailIgnoreCase(newEmail)
                    .filter(other -> !Objects.equals(other.getId(), id))
                    .isPresent()) {
                throw new DuplicateEmailException("Cette adresse email est déjà utilisée.");
            }
            if (utilisateurRepository.findByEmailIgnoreCase(newEmail)
                    .filter(other -> {
                        Long prevUserId = utilisateurRepository.findByEmailIgnoreCase(previousEmail)
                                .map(Utilisateur::getId).orElse(null);
                        return !Objects.equals(other.getId(), prevUserId);
                    }).isPresent()) {
                throw new DuplicateEmailException("Cette adresse email est déjà utilisée.");
            }
        }

        boolean wasDisponible = collaborateur.isDisponible();
        boolean willBeDisponible = request.isDisponible();
        boolean disponibiliteChanged = wasDisponible != willBeDisponible;

        collaborateur.setNom(normalizedNom);
        collaborateur.setPrenom(normalizedPrenom);
        collaborateur.setEmail(newEmail);
        collaborateur.setTelephone(normalizeText(request.getTelephone()));
        collaborateur.setPhotoUrl(normalizeText(request.getPhotoUrl()));
        collaborateur.setRole(normalizedRole);
        collaborateur.setDepartement(normalizeText(request.getDepartement()));
        collaborateur.setExperienceAnnees(request.getExperienceAnnees());
        collaborateur.setDisponible(willBeDisponible);
        collaborateur.setCompetences(resolveCompetences(request.getCompetenceIds()));

        Collaborateur saved = collaborateurRepository.save(collaborateur);
        
        if (disponibiliteChanged) {
            updateDisponibiliteTable(saved.getId(), willBeDisponible);
        }
        
        syncUtilisateur(saved, previousEmail, false);
        return toResponse(saved);
    }

    public CollaborateurResponse updateRole(Long id, String role) {
        Collaborateur collaborateur = findCollaborateurById(id);

        collaborateur.setRole(normalizeRole(role));
        Collaborateur saved = collaborateurRepository.save(collaborateur);
        syncUtilisateur(saved, saved.getEmail(), false);
        return toResponse(saved);
    }

    public CollaborateurResponse updateStatutCompte(Long id, String statut) {
        Collaborateur collaborateur = findCollaborateurById(id);
        Utilisateur utilisateur = utilisateurRepository.findByEmailIgnoreCase(collaborateur.getEmail())
                .orElseThrow(() -> new ResourceNotFoundException("Utilisateur introuvable pour l'email : " + collaborateur.getEmail()));

        String normalizedStatut = normalizeStatutCompte(statut);
        if ("ACTIF".equals(normalizedStatut) && !Boolean.TRUE.equals(utilisateur.getEmailVerifie())) {
            throw new BusinessException("Le compte ne peut pas être activé tant que l'adresse email n'est pas vérifiée.");
        }
        utilisateur.setActif("ACTIF".equals(normalizedStatut));
        utilisateurRepository.save(utilisateur);
        return toResponse(collaborateur);
    }

    public com.smartassign.pfe.dto.MessageResponse renvoyerVerificationEmail(Long id) {
        Collaborateur collaborateur = findCollaborateurById(id);
        Utilisateur utilisateur = utilisateurRepository.findByEmailIgnoreCase(collaborateur.getEmail())
                .orElseThrow(() -> new ResourceNotFoundException("Utilisateur introuvable pour l'email : " + collaborateur.getEmail()));

        if (Boolean.TRUE.equals(utilisateur.getEmailVerifie())) {
            return new com.smartassign.pfe.dto.MessageResponse("L'adresse email est déjà vérifiée.");
        }

        EmailDeliveryStatus status = sendVerificationEmail(utilisateur, collaborateur);
        if (!status.sent()) {
            throw new BusinessException(
                "Impossible d'envoyer l'email de vérification. " +
                (status.error() != null ? status.error() : "Vérifiez la configuration SMTP.")
            );
        }

        return new com.smartassign.pfe.dto.MessageResponse("Email de vérification renvoyé avec succès.");
    }

    public CollaborateurResponse toggleDisponibilite(Long id) {
        Collaborateur collaborateur = findCollaborateurById(id);
        boolean newDisponibiliteState = !collaborateur.isDisponible();

        collaborateur.setDisponible(newDisponibiliteState);
        Collaborateur saved = collaborateurRepository.save(collaborateur);
        
        updateDisponibiliteTable(saved.getId(), newDisponibiliteState);
        
        return toResponse(saved);
    }

    /**
     * Synchronise les deux tables lors d'une mise à jour de disponibilité:
     * - collaborateurs.disponible (boolean)
     * - disponibilites_utilisateurs.statut (string)
     * Cette méthode garantit que les deux mises à jour sont atomiques (même transaction).
     */
    private void updateDisponibiliteTable(Long collaborateurId, boolean disponible) {
        String statut = disponible ? "Disponible" : "Indisponible";
        
        // Chercher ou créer l'entrée dans disponibilites_utilisateurs
        DisponibiliteUtilisateur disponibiliteUtilisateur = disponibiliteUtilisateurRepository
            .findById(collaborateurId)
            .orElseGet(() -> new DisponibiliteUtilisateur());
        
        disponibiliteUtilisateur.setUserId(collaborateurId);
        disponibiliteUtilisateur.setStatut(statut);
        disponibiliteUtilisateurRepository.save(disponibiliteUtilisateur);
        
        LOGGER.info("Disponibilité mise à jour pour collaborateur ID {} : {} (disponibilites_utilisateurs.statut={})", 
            collaborateurId, disponible ? "Disponible" : "Indisponible", statut);
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
                    emailVerificationTokenRepository.deleteByUtilisateur_Id(utilisateur.getId());
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

    @Transactional(readOnly = true)
    public MesProjetsDto getMesProjets(Long requestedCollaborateurId, String authenticatedEmail) {
        String normalizedEmail = normalizeEmail(authenticatedEmail);
        if (normalizedEmail.isBlank()) {
            throw new BusinessException("Session collaborateur introuvable.");
        }

        Collaborateur connectedCollaborateur = findCollaborateurByEmail(normalizedEmail);
        Long effectiveCollaborateurId = connectedCollaborateur.getId();
        Utilisateur connectedUtilisateur = findUtilisateurByEmail(normalizedEmail);
        Long effectiveUserId = connectedUtilisateur.getId();

        if (requestedCollaborateurId != null && !Objects.equals(requestedCollaborateurId, effectiveCollaborateurId)) {
            LOGGER.warn("[MES_PROJETS] Requested id {} differs from authenticated collaborateur id {}. Using authenticated id.",
                requestedCollaborateurId, effectiveCollaborateurId);
        }

        int projetsActifs = affectationRepository.countProjetsActifs(effectiveCollaborateurId);
        int projetsTermines = affectationRepository.countProjetsTermines(effectiveCollaborateurId);
        double chargeActuelle = roundTwoDecimals(affectationRepository.getChargeActuelle(effectiveCollaborateurId));
        double compatibiliteMoyenne = chargeActuelle;

        List<MesProjetsDto.TacheDto> taches = tacheRepository.getTachesForMesProjets(effectiveCollaborateurId)
            .stream()
            .map(this::toMesProjetsTache)
            .toList();

        System.out.println("effectiveUserId = " + effectiveUserId);
        List<MesProjetsDto.JalonDto> jalons = jalonRepository.getUpcomingJalonsForUser(effectiveUserId)
            .stream()
            .map(this::toMesProjetsJalon)
            .toList();

        return MesProjetsDto.builder()
            .projetsActifs(projetsActifs)
            .chargeActuelle(chargeActuelle)
            .compatibiliteMoyenne(compatibiliteMoyenne)
            .projetsTermines(projetsTermines)
            .taches(taches)
            .jalons(jalons)
            .build();
    }

    public CollaborateurResponse toResponse(Collaborateur collaborateur) {
        return toResponse(collaborateur, null, EmailDeliveryStatus.notSent(), EmailDeliveryStatus.notSent());
        }

        public CollaborateurResponse toResponse(Collaborateur collaborateur, String generatedPassword) {
            return toResponse(collaborateur, generatedPassword, EmailDeliveryStatus.notSent(), EmailDeliveryStatus.notSent());
        }

        public CollaborateurResponse toResponse(Collaborateur collaborateur, String generatedPassword, EmailDeliveryStatus emailStatus, EmailDeliveryStatus verificationStatus) {
        Set<CompetenceResponse> competences = (collaborateur.getCompetences() == null ? Set.<Competence>of() : collaborateur.getCompetences()).stream()
                .map(comp -> new CompetenceResponse(comp.getId(), comp.getNom()))
                .collect(Collectors.toSet());

        VerificationState verificationState = resolveVerificationState(collaborateur.getEmail());
        boolean emailVerifie = verificationState.verified();
        boolean disponible = affectationRepository.countProjetsActifs(collaborateur.getId()) == 0;

        return CollaborateurResponse.builder()
                .id(collaborateur.getId())
                .nom(collaborateur.getNom())
                .prenom(collaborateur.getPrenom())
                .email(collaborateur.getEmail())
            .telephone(collaborateur.getTelephone())
                .photoUrl(collaborateur.getPhotoUrl())
                .role(normalizeRole(collaborateur.getRole()))
                .departement(collaborateur.getDepartement())
                .motDePasseGenere(generatedPassword)
                .emailEnvoye(emailStatus.sent())
                .emailErreur(emailStatus.error())
                .emailVerifie(emailVerifie)
                .emailVerifieLe(verificationState.verifiedAt())
                .statutVerificationEmail(emailVerifie ? "VERIFIE" : "NON_VERIFIE")
                .verificationEmailEnvoye(verificationStatus.sent())
                .verificationEmailErreur(verificationStatus.error())
                .statutCompte(resolveStatutCompte(collaborateur.getEmail()))
                .experienceAnnees(collaborateur.getExperienceAnnees())
                .disponible(disponible)
                .competences(competences)
                .build();
    }

    /** Resultat d'envoi d'email — distingue "non tente", "envoye" et "echec". */
    public record EmailDeliveryStatus(boolean sent, String error) {
        public static EmailDeliveryStatus ok() { return new EmailDeliveryStatus(true, null); }
        public static EmailDeliveryStatus failed(String error) { return new EmailDeliveryStatus(false, error); }
        public static EmailDeliveryStatus notSent() { return new EmailDeliveryStatus(false, null); }
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

        private Utilisateur findUtilisateurByEmail(String email) {
        return utilisateurRepository.findByEmailIgnoreCase(email)
            .orElseThrow(() -> new ResourceNotFoundException("Utilisateur introuvable pour l'email : " + email));
        }

        private Competence findCompetenceById(Long id) {
        return competenceRepository.findById(id)
            .orElseThrow(() -> new ResourceNotFoundException("Compétence introuvable : " + id));
        }

    private UtilisateurSyncResult syncUtilisateur(Collaborateur collaborateur, String previousEmail, boolean forceUnverified) {
        Utilisateur utilisateur = findUtilisateurForSync(previousEmail, collaborateur.getEmail())
                .orElseGet(() -> Utilisateur.builder().build());
        String generatedPassword = null;

        boolean emailChanged = previousEmail != null
                && !previousEmail.isBlank()
                && collaborateur.getEmail() != null
                && !previousEmail.equalsIgnoreCase(collaborateur.getEmail());

        utilisateur.setNom(buildDisplayName(collaborateur.getPrenom(), collaborateur.getNom()));
        utilisateur.setEmail(collaborateur.getEmail());
        utilisateur.setRole(normalizeRole(collaborateur.getRole()));
        utilisateur.setTelephone(normalizeText(collaborateur.getTelephone()));
        utilisateur.setDepartement(normalizeText(collaborateur.getDepartement()));

        if (forceUnverified || emailChanged || utilisateur.getEmailVerifie() == null) {
            utilisateur.setEmailVerifie(false);
            utilisateur.setEmailVerifieLe(null);
            utilisateur.setActif(false);
        }

        if (utilisateur.getMotDePasse() == null || utilisateur.getMotDePasse().isBlank()) {
            generatedPassword = generatePassword();
            utilisateur.setMotDePasse(passwordEncoder.encode(generatedPassword));
        } else if (!isPasswordEncoded(utilisateur.getMotDePasse())) {
            utilisateur.setMotDePasse(passwordEncoder.encode(utilisateur.getMotDePasse()));
        }

        Utilisateur savedUtilisateur = utilisateurRepository.save(utilisateur);
        return new UtilisateurSyncResult(savedUtilisateur, generatedPassword);
    }

    private record UtilisateurSyncResult(Utilisateur utilisateur, String generatedPassword) {}

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

    private MesProjetsDto.TacheDto toMesProjetsTache(Tache tache) {
        return MesProjetsDto.TacheDto.builder()
            .id(tache.getId())
            .titre(tache.getTitre())
            .statut(tache.getStatut())
            .priorite(tache.getPriorite())
            .dateEcheance(tache.getDateEcheance())
            .projetId(tache.getProjet() != null ? tache.getProjet().getId() : null)
            .projetNom(tache.getProjet() != null ? tache.getProjet().getNom() : null)
            .build();
    }

    private MesProjetsDto.JalonDto toMesProjetsJalon(Jalon jalon) {
        return MesProjetsDto.JalonDto.builder()
            .titre(jalon.getTitre())
            .date(jalon.getDate())
            .statut(jalon.getStatut())
            .description(jalon.getDescription())
            .build();
    }

    private double roundTwoDecimals(Double value) {
        double source = value == null ? 0d : value;
        return Math.round(source * 100.0d) / 100.0d;
    }

    @SuppressWarnings("unused")
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

    private String normalizeStatutCompte(String statut) {
        String normalized = statut == null ? "ACTIF" : statut.trim().toUpperCase(Locale.ROOT);
        if (!"ACTIF".equals(normalized) && !"SUSPENDU".equals(normalized)) {
            throw new BusinessException("Statut de compte invalide. Valeurs attendues: ACTIF ou SUSPENDU.");
        }
        return normalized;
    }

    private String resolveStatutCompte(String email) {
        if (email == null || email.isBlank()) {
            return "EN_ATTENTE_VERIFICATION";
        }

        return utilisateurRepository.findByEmailIgnoreCase(email)
                .map(user -> {
                    if (!Boolean.TRUE.equals(user.getEmailVerifie())) {
                        return "EN_ATTENTE_VERIFICATION";
                    }
                    return Boolean.FALSE.equals(user.getActif()) ? "SUSPENDU" : "ACTIF";
                })
                .orElse("EN_ATTENTE_VERIFICATION");
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

    /**
     * Envoie l'email de bienvenue contenant les identifiants au collaborateur.
     *
     * <p>Les erreurs SMTP ne sont pas masquees : elles sont journalisees au niveau
     * ERROR par {@link CredentialsMailService}. On capture ici la
     * {@link BusinessException} pour ne pas faire echouer la creation du compte
     * si l'email ne peut pas partir — l'admin doit alors transmettre les
     * identifiants manuellement (visible dans la reponse HTTP).
     */
    private EmailDeliveryStatus sendWelcomeEmail(Collaborateur collaborateur, String generatedPassword) {
        try {
            credentialsMailService.sendCredentialsEmail(
                    collaborateur.getEmail(),
                    buildDisplayName(collaborateur.getPrenom(), collaborateur.getNom()),
                    generatedPassword,
                    CredentialsMailKind.WELCOME);
            return EmailDeliveryStatus.ok();
        } catch (BusinessException exception) {
            LOGGER.warn(
                    "[EMAIL] Email de bienvenue non envoye a {} (compte cree quand meme) : {}",
                    collaborateur.getEmail(), exception.getMessage());
            return EmailDeliveryStatus.failed(exception.getMessage());
        }
    }

    private EmailDeliveryStatus sendVerificationEmail(Utilisateur utilisateur, Collaborateur collaborateur) {
        if (utilisateur == null || utilisateur.getId() == null || utilisateur.getEmail() == null || utilisateur.getEmail().isBlank()) {
            return EmailDeliveryStatus.failed("Utilisateur incomplet pour la verification email.");
        }

        String rawToken = generateVerificationToken();
        LocalDateTime expiresAt = LocalDateTime.now().plusMinutes(emailVerificationExpirationMinutes);

        emailVerificationTokenRepository.deleteByUtilisateur_Id(utilisateur.getId());
        emailVerificationTokenRepository.save(com.smartassign.pfe.entity.EmailVerificationToken.builder()
                .utilisateur(utilisateur)
                .tokenHash(hashToken(rawToken))
                .expiresAt(expiresAt)
                .build());

        String link = buildEmailVerificationLink(rawToken);
        String shortCode = rawToken.length() > 8 ? rawToken.substring(0, 8) : rawToken;

        try {
            credentialsMailService.sendEmailVerification(
                    utilisateur.getEmail(),
                    buildDisplayName(collaborateur.getPrenom(), collaborateur.getNom()),
                    link,
                    shortCode);
            return EmailDeliveryStatus.ok();
        } catch (BusinessException exception) {
            LOGGER.warn("[EMAIL] Verification email non envoyee a {} : {}", utilisateur.getEmail(), exception.getMessage());
            return EmailDeliveryStatus.failed(exception.getMessage());
        }
    }

    private String generateVerificationToken() {
        byte[] tokenBytes = new byte[32];
        SECURE_RANDOM.nextBytes(tokenBytes);
        return TOKEN_ENCODER.encodeToString(tokenBytes);
    }

    private String hashToken(String rawToken) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            return HexFormat.of().formatHex(digest.digest(rawToken.getBytes(java.nio.charset.StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException exception) {
            throw new IllegalStateException("SHA-256 indisponible pour la verification email.", exception);
        }
    }

    private String buildEmailVerificationLink(String rawToken) {
        String separator = emailVerificationUrl.contains("?") ? "&" : "?";
        return emailVerificationUrl + separator + "token=" + java.net.URLEncoder.encode(rawToken, java.nio.charset.StandardCharsets.UTF_8);
    }

    private VerificationState resolveVerificationState(String email) {
        if (email == null || email.isBlank()) {
            return new VerificationState(false, null);
        }

        return utilisateurRepository.findByEmailIgnoreCase(email)
                .map(user -> new VerificationState(Boolean.TRUE.equals(user.getEmailVerifie()), user.getEmailVerifieLe()))
                .orElseGet(() -> new VerificationState(false, null));
    }

    private record VerificationState(boolean verified, LocalDateTime verifiedAt) {}

    private String normalizeEmail(String email) {
        return email == null ? "" : email.trim().toLowerCase(Locale.ROOT);
    }

    private String normalizeAndValidateEmail(String email) {
        String normalizedEmail = normalizeEmail(email);
        if (!EMAIL_PATTERN.matcher(normalizedEmail).matches()) {
            throw new BusinessException("Veuillez saisir une adresse email valide.");
        }

        String[] parts = normalizedEmail.split("@", 2);
        if (parts.length != 2 || !ALLOWED_EMAIL_DOMAINS.contains(parts[1])) {
            throw new BusinessException("Veuillez saisir une adresse email valide.");
        }

        return normalizedEmail;
    }

    private String normalizeText(String value) {
        return value == null ? null : (value.trim().isEmpty() ? null : value.trim());
    }

    private void syncMissingCollaborateursFromUtilisateurs() {
        syncMissingCollaborateursFromUtilisateurs(false);
    }

    private void syncMissingCollaborateursFromUtilisateurs(boolean includeAllRoles) {
        List<Utilisateur> utilisateurs = utilisateurRepository.findAll();
        Set<String> processedEmails = new HashSet<>();

        for (Utilisateur utilisateur : utilisateurs) {
            String utilisateurRole = utilisateur.getRole() == null ? "" : utilisateur.getRole().trim().toUpperCase();
            if (!includeAllRoles && !"COLLAB".equals(utilisateurRole)) {
                continue;
            }
            String email = normalizeEmail(utilisateur.getEmail());
            if (email.isBlank() || !processedEmails.add(email) || collaborateurRepository.findByEmailIgnoreCase(email).isPresent()) {
                continue;
            }

            String displayName = normalizeName(utilisateur.getNom());
            String prenom = displayName;
            String nom = displayName;

            if (!displayName.isBlank()) {
                String[] parts = displayName.split("\\s+");
                prenom = parts[0];
                nom = parts.length > 1 ? String.join(" ", java.util.Arrays.copyOfRange(parts, 1, parts.length)) : parts[0];
            }

            Collaborateur collaborateur = Collaborateur.builder()
                    .nom(nom)
                    .prenom(prenom)
                    .email(email)
                    .telephone(normalizeText(utilisateur.getTelephone()))
                    .role(normalizeRole(utilisateur.getRole()))
                    .departement(normalizeText(utilisateur.getDepartement()))
                    .experienceAnnees(0)
                    .disponible(true)
                    .build();

            try {
                collaborateurRepository.save(collaborateur);
            } catch (org.springframework.dao.DataIntegrityViolationException ex) {
                LOGGER.debug("Synchronisation collaborateurs: email deja present, insertion ignoree: {}", email);
            }
        }
    }
}
