package com.smartassign.pfe.security;

public final class RoleNormalizer {

    private RoleNormalizer() {
    }

    public static String normalize(String role) {
        if (role == null || role.isBlank()) {
            return "COLLAB";
        }

        String normalized = role.trim().toUpperCase();

        if (normalized.contains("ADMIN")) {
            return "ADMIN";
        }
        if (normalized.contains("MANAGER") || normalized.contains("CHEF")) {
            return "MANAGER";
        }
        if (normalized.contains("COLLAB")) {
            return "COLLAB";
        }

        return "COLLAB";
    }
}
