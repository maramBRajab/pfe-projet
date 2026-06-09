package com.smartassign.pfe.service;

import java.util.List;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.smartassign.pfe.dto.AdminDepartementDto.CollaborateurDepartementRow;
import com.smartassign.pfe.dto.AdminDepartementDto.UpdateDepartementRequest;
import com.smartassign.pfe.entity.Utilisateur;
import com.smartassign.pfe.repository.UtilisateurRepository;

import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class AdminDepartementServiceImpl implements AdminDepartementService {

    private final UtilisateurRepository utilisateurRepository;

    @Override
    public List<CollaborateurDepartementRow> listCollaborateursDepartements() {
        return utilisateurRepository.findByRoleIgnoreCase("COLLAB").stream()
            .map(user -> new CollaborateurDepartementRow(
                user.getId(),
                safeText(user.getNom()),
                safeText(user.getEmail()),
                safeText(user.getDepartement())
            ))
            .toList();
    }

    @Override
    @Transactional
    public int updateCollaborateursDepartements(List<UpdateDepartementRequest> updates) {
        if (updates == null || updates.isEmpty()) {
            return 0;
        }

        int updated = 0;
        for (UpdateDepartementRequest update : updates) {
            if (update == null || update.userId() == null) {
                continue;
            }

            Utilisateur user = utilisateurRepository
                .findByIdAndRoleIgnoreCase(update.userId(), "COLLAB")
                .orElse(null);
            if (user == null) {
                continue;
            }

            String normalizedDepartement = normalizeDepartement(update.departement());
            if (equalsDepartement(user.getDepartement(), normalizedDepartement)) {
                continue;
            }

            user.setDepartement(normalizedDepartement);
            utilisateurRepository.save(user);
            updated++;
        }

        return updated;
    }

    private static String safeText(String value) {
        return value == null ? "" : value.trim();
    }

    private static String normalizeDepartement(String value) {
        if (value == null) {
            return null;
        }
        String normalized = value.trim();
        return normalized.isEmpty() ? null : normalized;
    }

    private static boolean equalsDepartement(String left, String right) {
        if (left == null) {
            return right == null;
        }
        if (right == null) {
            return false;
        }
        return left.trim().equalsIgnoreCase(right.trim());
    }
}
