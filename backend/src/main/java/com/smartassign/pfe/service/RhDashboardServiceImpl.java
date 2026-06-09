package com.smartassign.pfe.service;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.text.Normalizer;
import java.util.List;
import java.util.Locale;
import java.util.Set;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.smartassign.pfe.dto.RhDashboardDto;
import com.smartassign.pfe.entity.ActiviteRh;
import com.smartassign.pfe.entity.DisponibiliteUtilisateur;
import com.smartassign.pfe.entity.Jalon;
import com.smartassign.pfe.entity.JournalRh;
import com.smartassign.pfe.repository.ActiviteRhRepository;
import com.smartassign.pfe.repository.DisponibiliteUtilisateurRepository;
import com.smartassign.pfe.repository.JalonRepository;
import com.smartassign.pfe.repository.JournalRhRepository;

import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class RhDashboardServiceImpl implements RhDashboardService {

    private static final DateTimeFormatter DATE_TIME_FORMAT = DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm", Locale.FRENCH);
    private static final Set<String> TECHNICAL_ACTIONS_EXCLUDED_FROM_RH = Set.of(
        "LOGIN",
        "CONNEXION",
        "LOGOUT",
        "DECONNEXION",
        "LOGIN_FAILED",
        "ECHEC_DE_CONNEXION",
        "CHANGE_PASSWORD",
        "CHANGEMENT_DE_MOT_DE_PASSE",
        "RESET_PASSWORD",
        "REINITIALISATION_MOT_DE_PASSE",
        "REINITIALISATION_DU_MOT_DE_PASSE",
        "RESEND_VERIFICATION",
        "RENVOI_EMAIL_VERIFICATION",
        "RENVOI_DE_EMAIL_DE_VERIFICATION",
        "RENVOI_DE_L_EMAIL_DE_VERIFICATION",
        "VERIFY_EMAIL",
        "VERIFICATION_EMAIL",
        "PARAMETRES",
        "GENERATE_TEST_DATA",
        "EXPORT",
        "ASSIGN",
        "UNASSIGN",
        "CREATE_PROJET",
        "UPDATE_PROJET",
        "DELETE_PROJET",
        "ROLE_CHANGE",
        "PERMISSION_CHANGE"
    );

    private final JalonRepository jalonRepository;
    private final ActiviteRhRepository activiteRhRepository;
    private final JournalRhRepository journalRhRepository;
    private final DisponibiliteUtilisateurRepository disponibiliteRepository;

    @Override
    public List<RhDashboardDto.JalonItem> getJalons(Long userId) {
        System.out.println("[RhDashboardService] getJalons appelé avec userId = " + userId);
        List<Jalon> jalons = userId != null
            ? jalonRepository.findByUserIdOrderByDateAsc(userId)
            : jalonRepository.findAllByOrderByDateAsc();
        System.out.println("[RhDashboardService] " + jalons.size() + " jalon(s) trouvé(s) pour userId = " + userId);

        return jalons.stream()
            .map(jalon -> new RhDashboardDto.JalonItem(
                jalon.getId(),
                jalon.getTitre(),
                jalon.getDescription(),
                format(jalon.getDate()),
                jalon.getStatut(),
                jalon.getUserId()
            ))
            .toList();
    }

    @Override
    @Transactional
    public RhDashboardDto.JalonItem createJalon(Long userId, String titre, String description, String statut) {
        Long targetUserId = userId != null ? userId : 1L;
        Jalon created = jalonRepository.save(Jalon.builder()
            .titre(titre)
            .description(description)
            .date(LocalDateTime.now().plusDays(1))
            .statut(statut)
            .userId(targetUserId)
            .build());

        activiteRhRepository.save(ActiviteRh.builder()
            .type("INFO")
            .message("Ajout de tache: " + titre)
            .date(LocalDateTime.now())
            .userId(targetUserId)
            .build());

        return new RhDashboardDto.JalonItem(
            created.getId(),
            created.getTitre(),
            created.getDescription(),
            format(created.getDate()),
            created.getStatut(),
            created.getUserId()
        );
    }

    @Override
    public List<RhDashboardDto.ActiviteItem> getActivites(Long userId) {
        List<ActiviteRh> activites = userId != null
            ? activiteRhRepository.findByUserIdOrderByDateDesc(userId)
            : activiteRhRepository.findAllByOrderByDateDesc();

        return activites.stream()
            .map(activite -> new RhDashboardDto.ActiviteItem(
                activite.getId(),
                activite.getType(),
                activite.getMessage(),
                format(activite.getDate()),
                activite.getUserId()
            ))
            .toList();
    }

    @Override
    public List<RhDashboardDto.JournalItem> getJournal() {
        return journalRhRepository.findAllByOrderByDateDesc().stream()
            .filter(entry -> isRhBusinessAction(entry.getAction()))
            .map(entry -> new RhDashboardDto.JournalItem(
                entry.getId(),
                entry.getAction(),
                entry.getUtilisateur(),
                format(entry.getDate()),
                entry.getDetails()
            ))
            .toList();
    }

    private boolean isRhBusinessAction(String action) {
        if (action == null || action.isBlank()) {
            return false;
        }

        String normalized = Normalizer.normalize(action, Normalizer.Form.NFD)
            .replaceAll("\\p{M}", "")
            .trim()
            .replaceAll("[\\s'-]+", "_")
            .toUpperCase(Locale.ROOT);
        return !TECHNICAL_ACTIONS_EXCLUDED_FROM_RH.contains(normalized);
    }

    @Override
    public List<RhDashboardDto.DisponibiliteItem> getDisponibilites() {
        return disponibiliteRepository.findAllByOrderByUserIdAsc().stream()
            .map(item -> new RhDashboardDto.DisponibiliteItem(item.getUserId(), item.getStatut()))
            .toList();
    }

    @Override
    @Transactional
    public void logJournalAction(String action, String utilisateur, String details) {
        journalRhRepository.save(JournalRh.builder()
            .action(action)
            .utilisateur(utilisateur == null || utilisateur.isBlank() ? "system" : utilisateur)
            .date(LocalDateTime.now())
            .details(details == null || details.isBlank() ? "Action enregistree" : details)
            .build());
    }

    @Override
    @Transactional
    public void generateTestData() {
        long jalonMissing = Math.max(0, 5 - jalonRepository.count());
        long activiteMissing = Math.max(0, 5 - activiteRhRepository.count());
        long journalMissing = Math.max(0, 5 - journalRhRepository.count());
        long dispoMissing = Math.max(0, 5 - disponibiliteRepository.count());
        LocalDateTime now = LocalDateTime.now();

        for (int i = 1; i <= jalonMissing; i++) {
            long userId = i;

            jalonRepository.save(Jalon.builder()
                .titre("Jalon RH " + i)
                .description("Verification des taches et echeances RH")
                .date(now.plusDays(i))
                .statut(i % 2 == 0 ? "EN_COURS" : "A_PLANIFIER")
                .userId(userId)
                .build());
        }

        for (int i = 1; i <= activiteMissing; i++) {
            long userId = i;

            activiteRhRepository.save(ActiviteRh.builder()
                .type(i % 2 == 0 ? "WARNING" : "INFO")
                .message(i % 2 == 0
                    ? "Point de vigilance sur l'activite utilisateur " + userId
                    : "Activite stable pour l'utilisateur " + userId)
                .date(now.minusHours(i * 2L))
                .userId(userId)
                .build());
        }

        for (int i = 1; i <= journalMissing; i++) {
            long userId = i;

            journalRhRepository.save(JournalRh.builder()
                .action(i % 2 == 0 ? "MODIFICATION_PROFIL" : "CREATION_UTILISATEUR")
                .utilisateur("user" + userId + "@smartassign.local")
                .date(now.minusMinutes(i * 15L))
                .details("Entree de journal RH de test #" + i)
                .build());
        }

        for (int i = 1; i <= dispoMissing; i++) {
            long userId = i;

            disponibiliteRepository.save(DisponibiliteUtilisateur.builder()
                .userId(userId)
                .statut(i % 3 == 0 ? "Conge" : (i % 2 == 0 ? "Occupe" : "Disponible"))
                .build());
        }
    }

    private String format(LocalDateTime dateTime) {
        return dateTime == null ? null : DATE_TIME_FORMAT.format(dateTime);
    }
}
