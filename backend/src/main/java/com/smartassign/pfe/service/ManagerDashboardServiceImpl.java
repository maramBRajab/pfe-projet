package com.smartassign.pfe.service;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.smartassign.pfe.dto.ManagerDashboardDto.Alerte;
import com.smartassign.pfe.dto.ManagerDashboardDto.AlertsResponse;
import com.smartassign.pfe.dto.ManagerDashboardDto.Stats;
import com.smartassign.pfe.entity.Utilisateur;
import com.smartassign.pfe.exception.ResourceNotFoundException;
import com.smartassign.pfe.repository.AffectationRepository;
import com.smartassign.pfe.repository.CollaborateurRepository;
import com.smartassign.pfe.repository.ProjetRepository;
import com.smartassign.pfe.repository.UtilisateurRepository;

import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class ManagerDashboardServiceImpl implements ManagerDashboardService {

    private final ProjetRepository projetRepository;
    private final CollaborateurRepository collaborateurRepository;
    private final AffectationRepository affectationRepository;
    private final UtilisateurRepository utilisateurRepository;

    @Override
    public Stats getStats(String managerEmail) {
        Long managerId = resolveManagerId(managerEmail);

        long projetsActifs      = projetRepository.countByManagerIdAndStatutIgnoreCase(managerId, "en_cours");
        long affectationsEnCours = affectationRepository.countActiveAffectationsByManager(managerId);
        long ressourcesDisponibles = collaborateurRepository.countAvailableCollaborateurCandidates();
        long totalCollaborateurs = collaborateurRepository.countCollaborateurCandidates();
        long collaborateursActifs = affectationRepository.countDistinctCollaborateurActifsByManager(managerId);
        long tauxAffectation = totalCollaborateurs == 0
                ? 0
                : Math.round((collaborateursActifs * 100.0) / totalCollaborateurs);
        long projetsEnRetard = projetRepository.countOverdueActiveProjectsByManager(managerId, LocalDate.now());
        long collaborateursSurcharges = affectationRepository.countOverloadedCollaborateurs();
        long alertesPrioritaires = projetsEnRetard + collaborateursSurcharges;
        double compatibiliteIa = roundTwoDecimals(affectationRepository.getAverageScoreByManager(managerId));

        return new Stats(
                projetsActifs,
                ressourcesDisponibles,
                affectationsEnCours,
                tauxAffectation,
                alertesPrioritaires,
                compatibiliteIa,
                totalCollaborateurs,
                projetsEnRetard,
                collaborateursSurcharges);
    }

    @Override
    public AlertsResponse getPriorityAlerts(String managerEmail) {
        Long managerId = resolveManagerId(managerEmail);

        long projetsEnRetard = projetRepository.countOverdueActiveProjectsByManager(managerId, LocalDate.now());
        long collaborateursSurcharges = affectationRepository.countOverloadedCollaborateurs();

        List<Alerte> items = new ArrayList<>();

        if (projetsEnRetard > 0) {
            items.add(new Alerte(
                    "danger",
                    "Projets en retard",
                    projetsEnRetard + " projet(s) en cours ont dépassé leur date de fin.",
                    "/manager/projets"));
        }

        if (collaborateursSurcharges > 0) {
            items.add(new Alerte(
                    "warning",
                    "Surcharges collaborateurs",
                    collaborateursSurcharges + " collaborateur(s) ont plus d'une affectation active.",
                    "/manager/charge-travail"));
        }

        return new AlertsResponse(items.size(), items);
    }

    private Long resolveManagerId(String managerEmail) {
        Utilisateur manager = utilisateurRepository.findByEmailIgnoreCase(managerEmail)
                .orElseThrow(() -> new ResourceNotFoundException("Manager introuvable : " + managerEmail));
        return manager.getId();
    }

    private static double roundTwoDecimals(double value) {
        return Math.round(value * 100.0) / 100.0;
    }
}
