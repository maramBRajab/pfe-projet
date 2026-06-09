package com.smartassign.pfe.service;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.stream.Collectors;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.smartassign.pfe.dto.AdminRolesDto.RoleItem;
import com.smartassign.pfe.dto.AdminRolesDto.RoleMember;
import com.smartassign.pfe.dto.AdminRolesDto.RolePermission;
import com.smartassign.pfe.entity.Utilisateur;
import com.smartassign.pfe.repository.UtilisateurRepository;

import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class AdminRolesServiceImpl implements AdminRolesService {

    private final UtilisateurRepository utilisateurRepository;

    private static final Map<String, String> ROLE_NAMES = Map.of(
        "ADMIN", "Administrateur",
        "MANAGER", "Manager",
        "COLLAB", "Collaborateur"
    );

    private static final Map<String, String> ROLE_DESCRIPTIONS = Map.of(
        "ADMIN", "Controle global de la plateforme",
        "MANAGER", "Gestion des projets et equipes",
        "COLLAB", "Acces personnel et consultation"
    );

    private static final Map<String, String> ROLE_ICONS = Map.of(
        "ADMIN", "admin",
        "MANAGER", "manager",
        "COLLAB", "collab"
    );

    private static final Map<String, String> ROLE_COLORS = Map.of(
        "ADMIN", "violet",
        "MANAGER", "blue",
        "COLLAB", "green"
    );

    private static final Map<String, List<RolePermission>> ROLE_PERMISSIONS = Map.of(
        "ADMIN", List.of(
            permission("manage_users", "Gerer utilisateurs"),
            permission("manage_roles", "Gerer roles"),
            permission("config_permissions", "Configurer permissions"),
            permission("view_audit", "Voir journal audit"),
            permission("system_settings", "Parametres systeme")
        ),
        "MANAGER", List.of(
            permission("create_projects", "Creer projets"),
            permission("edit_projects", "Modifier projets"),
            permission("assign_collabs", "Affecter collaborateurs"),
            permission("track_assignments", "Suivi affectations")
        ),
        "COLLAB", List.of(
            permission("view_own_projects", "Voir ses projets"),
            permission("view_planning", "Consulter planning"),
            permission("view_competences", "Voir competences")
        )
    );

    @Override
    public List<RoleItem> getRoles() {
        List<Utilisateur> users = utilisateurRepository.findAll();

        Map<String, Long> countsByRole = new LinkedHashMap<>();
        countsByRole.put("ADMIN", 0L);
        countsByRole.put("MANAGER", 0L);
        countsByRole.put("COLLAB", 0L);

        Map<String, List<RoleMember>> membersByRole = new LinkedHashMap<>();
        membersByRole.put("ADMIN", new java.util.ArrayList<>());
        membersByRole.put("MANAGER", new java.util.ArrayList<>());
        membersByRole.put("COLLAB", new java.util.ArrayList<>());

        for (Utilisateur user : users) {
            String normalizedRole = normalizeRole(user.getRole());
            countsByRole.put(normalizedRole, countsByRole.getOrDefault(normalizedRole, 0L) + 1L);
            membersByRole.computeIfAbsent(normalizedRole, key -> new java.util.ArrayList<>())
                .add(new RoleMember(
                    user.getId(),
                    safeText(user.getNom()),
                    safeText(user.getEmail()),
                    normalizedRole
                ));
        }

        return countsByRole.entrySet().stream()
            .map(entry -> {
                String roleCode = entry.getKey();
                return new RoleItem(
                    roleCode.toLowerCase(Locale.ROOT),
                    roleCode,
                    ROLE_NAMES.getOrDefault(roleCode, roleCode),
                    ROLE_DESCRIPTIONS.getOrDefault(roleCode, "Role systeme"),
                    ROLE_ICONS.getOrDefault(roleCode, "collab"),
                    ROLE_COLORS.getOrDefault(roleCode, "green"),
                    entry.getValue(),
                    true,
                    ROLE_PERMISSIONS.getOrDefault(roleCode, List.of()),
                    membersByRole.getOrDefault(roleCode, List.of()).stream()
                        .sorted((left, right) -> left.nom().compareToIgnoreCase(right.nom()))
                        .collect(Collectors.toList())
                );
            })
            .toList();
    }

    private static String normalizeRole(String rawRole) {
        String role = rawRole == null ? "" : rawRole.trim().toUpperCase(Locale.ROOT);
        if (role.contains("ADMIN")) {
            return "ADMIN";
        }
        if (role.contains("MANAGER") || role.contains("CHEF")) {
            return "MANAGER";
        }
        return "COLLAB";
    }

    private static RolePermission permission(String id, String label) {
        return new RolePermission(id, label, true);
    }

    private static String safeText(String value) {
        return value == null ? "" : value.trim();
    }
}
