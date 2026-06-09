package com.smartassign.pfe.service;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.stream.Collectors;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.smartassign.pfe.dto.SystemReportDto;
import com.smartassign.pfe.entity.Affectation;
import com.smartassign.pfe.entity.Projet;
import com.smartassign.pfe.entity.Settings;
import com.smartassign.pfe.entity.Utilisateur;
import com.smartassign.pfe.model.AuditLog;
import com.smartassign.pfe.repository.AffectationRepository;
import com.smartassign.pfe.repository.AuditLogRepository;
import com.smartassign.pfe.repository.CollaborateurRepository;
import com.smartassign.pfe.repository.ProjetRepository;
import com.smartassign.pfe.repository.SettingsRepository;
import com.smartassign.pfe.repository.UtilisateurRepository;

import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class AdminReportsServiceImpl implements AdminReportsService {

    private final UtilisateurRepository utilisateurRepository;
    private final CollaborateurRepository collaborateurRepository;
    private final ProjetRepository projetRepository;
    private final AffectationRepository affectationRepository;
    private final AuditLogRepository auditLogRepository;
    private final SettingsRepository settingsRepository;

    @Override
    public SystemReportDto getSystemReport() {

        List<Utilisateur> allUsers = utilisateurRepository.findAll();
        List<Affectation> allAffectations = affectationRepository.findAll();
        List<Projet> allProjets = projetRepository.findAll();
        List<AuditLog> allAudits = auditLogRepository.findAll();

        LocalDate today = LocalDate.now();
        LocalDate startOfMonth = today.withDayOfMonth(1);
        LocalDate startOfLastMonth = startOfMonth.minusMonths(1);
        LocalDateTime startOfMonthDt = startOfMonth.atStartOfDay();
        LocalDateTime startOfLastMonthDt = startOfLastMonth.atStartOfDay();
        LocalDateTime now = LocalDateTime.now();
        LocalDateTime endOfLastMonthDt = startOfMonthDt.minusNanos(1);
        LocalDateTime last24h = now.minusHours(24);
        LocalDateTime last30d = now.minusDays(30);

        long totalComptes = utilisateurRepository.count();

        long creesCeMois = utilisateurRepository.countByCreatedAtBetween(startOfMonthDt, now);
        long creesMoisDernier = utilisateurRepository.countByCreatedAtBetween(startOfLastMonthDt, endOfLastMonthDt);

        Set<String> emailsSuspendus = allUsers.stream()
            .filter(u -> Boolean.FALSE.equals(u.getActif()))
            .map(Utilisateur::getEmail)
            .filter(email -> email != null && !email.isBlank())
            .map(email -> email.trim().toLowerCase(Locale.FRENCH))
            .collect(Collectors.toCollection(HashSet::new));

        long suspendus = collaborateurRepository.findAll().stream()
            .map(c -> c.getEmail())
            .filter(email -> email != null && !email.isBlank())
            .map(email -> email.trim().toLowerCase(Locale.FRENCH))
            .filter(emailsSuspendus::contains)
            .count();

        SystemReportDto.ComptesCreesDto comptesDto = SystemReportDto.ComptesCreesDto.builder()
            .total(totalComptes)
            .ceMois(creesCeMois)
            .moisDernier(creesMoisDernier)
            .suspendus(suspendus)
            .build();

        long connexions24h = countDistinctLoginUsersInPeriod(allAudits, last24h, null);
        long loginsCeMois = countDistinctLoginUsersInPeriod(allAudits, startOfMonthDt, null);
        long loginsMoisDernier = countDistinctLoginUsersInPeriod(allAudits, startOfLastMonthDt, startOfMonthDt);

        double evolutionConnexions;
        if (loginsMoisDernier == 0) {
            evolutionConnexions = loginsCeMois > 0 ? 100.0 : 0.0;
        } else {
            evolutionConnexions = Math.round(((double) (loginsCeMois - loginsMoisDernier) / loginsMoisDernier) * 100.0);
        }

        SystemReportDto.ConnexionsDto connexionsDto = SystemReportDto.ConnexionsDto.builder()
            .actives(connexions24h)
            .evolution(evolutionConnexions)
            .build();

        long totalCollabs = collaborateurRepository.count();
        Set<Long> collabsAffectesIds = allAffectations.stream()
            .filter(a -> a.getCollaborateur() != null)
            .map(a -> a.getCollaborateur().getId())
            .collect(Collectors.toSet());
        int tauxGlobal = totalCollabs == 0 ? 0 : (int) Math.round((double) collabsAffectesIds.size() / totalCollabs * 100);

        int cibleAffectation = settingsRepository.findById(1L)
            .map(Settings::getSeuilCompatibilite)
            .orElse(75);

        SystemReportDto.AffectationDto affectationDto = SystemReportDto.AffectationDto.builder()
            .tauxGlobal(tauxGlobal)
            .cible(cibleAffectation)
            .build();

        long projetsEnCours = projetRepository.countByStatutIgnoreCase("EN_COURS");
        long projetsAttente = allProjets.stream().filter(p -> matchStatut(p, "EN_ATTENTE")).count();
        long projetsTermines = allProjets.stream().filter(p -> matchStatut(p, "TERMINE")).count();
        long totalProjets = projetRepository.count();

        SystemReportDto.ProjetsDto projetsDto = SystemReportDto.ProjetsDto.builder()
            .total(totalProjets)
            .enCours(projetsEnCours)
            .enAttente(projetsAttente)
            .termines(projetsTermines)
            .build();

        long collabsAvecCompetences = collaborateurRepository.findAll().stream()
            .filter(c -> c.getCompetences() != null && !c.getCompetences().isEmpty())
            .count();
        int pctCompetences = totalCollabs == 0 ? 0 : (int) Math.round((double) collabsAvecCompetences / totalCollabs * 100);

        // Projets en cours = EN_COURS / total projets * 100
        double tauxProjetsActifs = totalProjets == 0
            ? 0
            : Math.round(projetsEnCours * 100.0 / totalProjets);

        // Calculer le taux de collaborateurs affectés (collaborateurs affectés / total * 100)
        double tauxCollaborateursAffectes = totalCollabs == 0 ? 0 : (double) collabsAffectesIds.size() / totalCollabs * 100;

        boolean modeMaintenance = settingsRepository.findById(1L)
            .map(Settings::getModeMaintenance)
            .orElse(false);

        long systemAuditsLast30d = allAudits.stream()
            .filter(a -> a.getDate() != null && !a.getDate().isBefore(last30d))
            .filter(a -> !isLoginAction(a))
            .count();
        long failedSystemAuditsLast30d = allAudits.stream()
            .filter(a -> a.getDate() != null && !a.getDate().isBefore(last30d))
            .filter(a -> !isLoginAction(a))
            .filter(a -> !isSuccess(a))
            .count();

        double uptimePlateforme;
        if (systemAuditsLast30d == 0) {
            uptimePlateforme = modeMaintenance ? 0.0 : 100.0;
        } else {
            uptimePlateforme = Math.max(0.0, Math.min(100.0,
                Math.round((((double) (systemAuditsLast30d - failedSystemAuditsLast30d) / systemAuditsLast30d) * 1000.0)) / 10.0
            ));
            if (modeMaintenance) {
                uptimePlateforme = 0.0;
            }
        }

        SystemReportDto.SanteSystemeDto santeDto = SystemReportDto.SanteSystemeDto.builder()
            .uptimePlateforme(uptimePlateforme)
            .tauxAffectation(tauxGlobal)
            .tauxProjetsActifs(tauxProjetsActifs)
            .tauxCollaborateursAffectes(tauxCollaborateursAffectes)
            .comptesAvecCompetences(pctCompetences)
            .build();

        List<SystemReportDto.EvolutionMoisDto> evolution = new ArrayList<>();
        for (int i = 5; i >= 0; i--) {
            LocalDate monthStart = today.minusMonths(i).withDayOfMonth(1);
            LocalDateTime ms = monthStart.atStartOfDay();
            LocalDateTime me = monthStart.plusMonths(1).atStartOfDay();
            long countInMonth = countAuditsInPeriod(allAudits, "CREATE_USER", ms, me);

            String label = monthLabelFr(monthStart.getMonthValue());

            evolution.add(SystemReportDto.EvolutionMoisDto.builder()
                .mois(label)
                .count(countInMonth)
                .build());
        }

        List<SystemReportDto.RepartitionDeptDto> repartition = utilisateurRepository
            .countCollaborateursByDepartementForReport()
            .stream()
            .map(row -> SystemReportDto.RepartitionDeptDto.builder()
                .departement(String.valueOf(row[0]))
                .count(((Number) row[1]).longValue())
                .build())
            .collect(Collectors.toList());

        return SystemReportDto.builder()
            .comptesCrees(comptesDto)
            .connexions(connexionsDto)
            .affectation(affectationDto)
            .projets(projetsDto)
            .santeSysteme(santeDto)
            .evolutionComptes(evolution)
            .repartitionDepartement(repartition)
            .build();
    }

    private static long countAuditsInPeriod(List<AuditLog> audits, String action, LocalDateTime fromInclusive, LocalDateTime toExclusive) {
        return audits.stream()
            .filter(a -> isAction(a, action) && isSuccess(a))
            .filter(a -> a.getDate() != null)
            .filter(a -> !a.getDate().isBefore(fromInclusive))
            .filter(a -> toExclusive == null || a.getDate().isBefore(toExclusive))
            .count();
    }

    private static long countDistinctLoginUsersInPeriod(List<AuditLog> audits, LocalDateTime fromInclusive, LocalDateTime toExclusive) {
        return audits.stream()
            .filter(a -> isAction(a, "LOGIN") && isSuccess(a))
            .filter(a -> a.getDate() != null)
            .filter(a -> !a.getDate().isBefore(fromInclusive))
            .filter(a -> toExclusive == null || a.getDate().isBefore(toExclusive))
            .map(AuditLog::getUser)
            .filter(u -> u != null && !u.isBlank())
            .map(u -> u.trim().toLowerCase(Locale.FRENCH))
            .distinct()
            .count();
    }

    private static boolean isLoginAction(AuditLog audit) {
        if (audit == null || audit.getAction() == null) {
            return false;
        }

        String action = audit.getAction().trim().toUpperCase(Locale.FRENCH);
        return "LOGIN".equals(action) || "LOGIN_FAILED".equals(action);
    }

    private static String monthLabelFr(int month) {
        return switch (month) {
            case 1 -> "Janv";
            case 2 -> "Fevr";
            case 3 -> "Mars";
            case 4 -> "Avr";
            case 5 -> "Mai";
            case 6 -> "Juin";
            case 7 -> "Juil";
            case 8 -> "Aout";
            case 9 -> "Sept";
            case 10 -> "Oct";
            case 11 -> "Nov";
            default -> "Dec";
        };
    }

    private static boolean isAction(AuditLog a, String expected) {
        return a != null && a.getAction() != null && a.getAction().trim().equalsIgnoreCase(expected);
    }

    private static boolean isSuccess(AuditLog a) {
        return a.getStatus() == null || a.getStatus().trim().equalsIgnoreCase("SUCCESS");
    }

    private static boolean matchStatut(Projet p, String expectedNormalized) {
        if (p == null || p.getStatut() == null) {
            return false;
        }

        String s = p.getStatut().trim()
            .toUpperCase(Locale.FRENCH)
            .replace('É', 'E')
            .replace('-', '_')
            .replace(' ', '_');

        return s.equals(expectedNormalized);
    }

}
