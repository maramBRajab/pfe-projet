package com.smartassign.pfe.security;

public final class PasswordHashUtils {

    private PasswordHashUtils() {
    }

    public static boolean isBcryptEncoded(String password) {
        return password != null
                && (password.startsWith("$2a$")
                        || password.startsWith("$2b$")
                        || password.startsWith("$2y$"));
    }
}
