package com.smartassign.pfe.dto;

import java.util.List;

public final class AdminRolesDto {

    private AdminRolesDto() {
    }

    public record RolePermission(
        String id,
        String label,
        boolean granted
    ) {
    }

    public record RoleMember(
        Long id,
        String nom,
        String email,
        String role
    ) {
    }

    public record RoleItem(
        String id,
        String code,
        String name,
        String description,
        String icon,
        String color,
        long usersCount,
        boolean systemRole,
        List<RolePermission> permissions,
        List<RoleMember> members
    ) {
    }
}
