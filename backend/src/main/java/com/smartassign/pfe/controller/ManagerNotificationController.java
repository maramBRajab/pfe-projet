package com.smartassign.pfe.controller;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;

import java.util.Set;
import java.util.stream.Collectors;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.transaction.annotation.Transactional;

import com.smartassign.pfe.dto.ManagerNotificationDto;
import com.smartassign.pfe.entity.Affectation;
import com.smartassign.pfe.entity.Collaborateur;
import com.smartassign.pfe.entity.NotificationLue;
import com.smartassign.pfe.entity.NotificationSupprimee;
import com.smartassign.pfe.entity.Projet;
import com.smartassign.pfe.repository.AffectationRepository;
import com.smartassign.pfe.repository.NotificationLueRepository;
import com.smartassign.pfe.repository.NotificationSupprimeeRepository;
import com.smartassign.pfe.repository.ProjetRepository;

@RestController
@RequestMapping("/api/manager/notifications")
public class ManagerNotificationController {

    private final ProjetRepository projetRepository;
    private final AffectationRepository affectationRepository;
    private final NotificationSupprimeeRepository notificationSupprimeeRepository;
    private final NotificationLueRepository notificationLueRepository;

    @Autowired
    public ManagerNotificationController(ProjetRepository projetRepository,
                                         AffectationRepository affectationRepository,
                                         NotificationSupprimeeRepository notificationSupprimeeRepository,
                                         NotificationLueRepository notificationLueRepository) {
        this.projetRepository = projetRepository;
        this.affectationRepository = affectationRepository;
        this.notificationSupprimeeRepository = notificationSupprimeeRepository;
        this.notificationLueRepository = notificationLueRepository;
    }

    @GetMapping
    @Transactional(readOnly = true)
    public List<ManagerNotificationDto> list() {
        List<ManagerNotificationDto> notifs = new ArrayList<>();
        long idSeq = 1L;
        
        Set<String> suppressedKeys = notificationSupprimeeRepository.findAll().stream()
                .map(NotificationSupprimee::getNotificationKey)
                .collect(Collectors.toSet());
        Set<String> readKeys = notificationLueRepository.findAllNotificationKeys().stream()
                .collect(Collectors.toSet());

        // 1) Affectations récentes (10 dernières) → type AFFECTATION
        List<Affectation> affectations = affectationRepository.findAllOrderByDateDesc();
        int limit = Math.min(affectations.size(), 10);
        for (int i = 0; i < limit; i++) {
            Affectation a = affectations.get(i);
            Collaborateur c = a.getCollaborateur();
            Projet p = a.getProjet();
            if (c == null || p == null) continue;

            String collabNom = safe(c.getPrenom()) + " " + safe(c.getNom());
            int scorePct = (int) Math.round(a.getScore());
            String categorie = categorieScore(scorePct);

            String key = "AFFECTATION_" + a.getId();
            if (!suppressedKeys.contains(key)) {
                notifs.add(new ManagerNotificationDto(
                    idSeq++,
                    "Affectation confirmée — " + collabNom.trim() + " → " + safe(p.getNom()),
                    "Score IA : " + scorePct + "% · Catégorie : " + categorie,
                    formatTemps(a.getDateAffectation()),
                    "AFFECTATION",
                    readKeys.contains(key),
                    "ti-check",
                    "icon-green",
                    "badge-affectation",
                    key
                ));
            }
        }

        // 2) Projets qui expirent dans <= 30 jours → type VIGILANCE
        LocalDate today = LocalDate.now();
        for (Projet p : projetRepository.findAll()) {
            if (p.getDateFin() == null) continue;
            long days = ChronoUnit.DAYS.between(today, p.getDateFin());
            if (days < 0 || days > 30) continue;

            long affCount = affectationRepository.findByProjetId(p.getId()).size();
            String description = affCount == 0
                ? "Aucune affectation définitive confirmée"
                : affCount + " ressource(s) affectée(s)";

            String key = "VIGILANCE_" + p.getId();
            if (!suppressedKeys.contains(key)) {
                notifs.add(new ManagerNotificationDto(
                    idSeq++,
                    "Projet " + safe(p.getNom()) + " expire dans " + days + " jour" + (days > 1 ? "s" : ""),
                    description,
                    "Échéance : " + p.getDateFin(),
                    "VIGILANCE",
                    readKeys.contains(key),
                    "ti-alert-triangle",
                    "icon-amber",
                    "badge-vigilance",
                    key
                ));
            }
        }

        // 3) Analyses IA (synthèse par projet ayant au moins une affectation récente) → type IA
        for (Projet p : projetRepository.findAll()) {
            List<Affectation> aff = affectationRepository.findByProjetIdOrderByScoreDesc(p.getId());
            if (aff.isEmpty()) continue;
            double moyenne = aff.stream().mapToDouble(Affectation::getScore).average().orElse(0);
            LocalDateTime derniere = aff.stream()
                .map(Affectation::getDateAffectation)
                .filter(d -> d != null)
                .max(Comparator.naturalOrder())
                .orElse(null);

            String key = "IA_" + p.getId();
            if (!suppressedKeys.contains(key)) {
                notifs.add(new ManagerNotificationDto(
                    idSeq++,
                    "Analyse IA terminée — " + safe(p.getNom()),
                    aff.size() + " collaborateur(s) trouvé(s) · Score moyen " + (int) Math.round(moyenne) + "%",
                    formatTemps(derniere),
                    "IA",
                    readKeys.contains(key),
                    "ti-robot",
                    "icon-green",
                    "badge-ia",
                    key
                ));
            }
        }

        // Tri global : plus récent en premier (basé sur le champ temps lexical de secours)
        notifs.sort(Comparator.comparing(ManagerNotificationDto::getTemps,
            Comparator.nullsLast(Comparator.reverseOrder())));

        return notifs;
    }

    @DeleteMapping("/{key}")
    public ResponseEntity<Void> deleteNotification(@PathVariable String key) {
        if (!notificationSupprimeeRepository.existsByNotificationKey(key)) {
            notificationSupprimeeRepository.save(new NotificationSupprimee(key));
        }
        return ResponseEntity.ok().build();
    }

    @PostMapping("/mark-all-read")
    @Transactional
    public ResponseEntity<Void> markAllRead(@RequestBody List<String> keys) {
        for (String key : keys) {
            if (key != null && !key.isBlank() && !notificationLueRepository.existsByNotificationKey(key)) {
                notificationLueRepository.save(new NotificationLue(key));
            }
        }
        return ResponseEntity.ok().build();
    }

    @GetMapping("/count")
    @Transactional(readOnly = true)
    public ResponseEntity<Long> countUnread() {
        List<ManagerNotificationDto> all = list();
        long unread = all.stream().filter(n -> !n.isLu()).count();
        return ResponseEntity.ok(unread);
    }

    private String formatTemps(LocalDateTime dt) {
        if (dt == null) return "";
        LocalDate today = LocalDate.now();
        String hhmm = String.format("%02d:%02d", dt.getHour(), dt.getMinute());
        if (dt.toLocalDate().isEqual(today)) {
            return "Aujourd'hui " + hhmm;
        }
        if (dt.toLocalDate().isEqual(today.minusDays(1))) {
            return "Hier " + hhmm;
        }
        return dt.toLocalDate() + " " + hhmm;
    }

    private String categorieScore(int score) {
        if (score >= 80) return "Excellent";
        if (score >= 65) return "Très bon";
        if (score >= 50) return "Bon";
        if (score >= 35) return "Moyen";
        return "Faible";
    }

    private String safe(String s) { return s == null ? "" : s; }
}
