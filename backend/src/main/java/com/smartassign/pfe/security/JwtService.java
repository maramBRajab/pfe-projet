package com.smartassign.pfe.security;

import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.Date;

import javax.crypto.SecretKey;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import com.smartassign.pfe.entity.Utilisateur;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.io.Decoders;
import io.jsonwebtoken.io.DecodingException;
import io.jsonwebtoken.security.Keys;

@Service
public class JwtService {

    private final SecretKey signingKey;
    private final long expirationMs;

    public JwtService(
        @Value("${app.security.jwt.secret}") String secret,
        @Value("${app.security.jwt.expiration-ms:86400000}") long expirationMs
    ) {
        this.signingKey = buildSigningKey(secret);
        this.expirationMs = expirationMs;
    }

    public String generateToken(Utilisateur utilisateur) {
        Instant now = Instant.now();

        return Jwts.builder()
            .subject(utilisateur.getEmail())
            .claim("role", utilisateur.getRole())
            .issuedAt(Date.from(now))
            .expiration(Date.from(now.plusMillis(expirationMs)))
            .signWith(signingKey)
            .compact();
    }

    public Claims extractClaims(String token) {
        return Jwts.parser()
            .verifyWith(signingKey)
            .build()
            .parseSignedClaims(token)
            .getPayload();
    }

    public String extractSubject(String token) {
        return extractClaims(token).getSubject();
    }

    private SecretKey buildSigningKey(String secret) {
        try {
            byte[] decodedSecret = Decoders.BASE64.decode(secret);
            return Keys.hmacShaKeyFor(decodedSecret);
        } catch (IllegalArgumentException | DecodingException exception) {
            return Keys.hmacShaKeyFor(secret.getBytes(StandardCharsets.UTF_8));
        }
    }
}