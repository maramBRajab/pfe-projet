package com.smartassign.pfe.service;

import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.smartassign.pfe.entity.Affectation;
import com.smartassign.pfe.entity.Collaborateur;
import com.smartassign.pfe.entity.Projet;
import com.smartassign.pfe.repository.AffectationRepository;
import com.smartassign.pfe.repository.CollaborateurRepository;
import com.smartassign.pfe.repository.ProjetRepository;

import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class ManagerIaService {

    private static final Logger LOGGER = LoggerFactory.getLogger(ManagerIaService.class);

    private final CollaborateurRepository collaborateurRepository;
    private final AffectationRepository affectationRepository;
    private final ProjetRepository projetRepository;
    private final ObjectMapper objectMapper;

    @Value("${anthropic.api.key:}")
    private String anthropicApiKey;

    @Value("${anthropic.api.url:https://api.anthropic.com/v1/messages}")
    private String anthropicApiUrl;

    @Value("${anthropic.api.model:claude-sonnet-4-20250514}")
    private String anthropicModel;

    public String analyserQuestion(String question) {
        String normalized = normalize(question);

        if (isDisponibiliteQuestion(normalized)) {
            return reponseDisponibilites();
        }

        if (isSurchargeQuestion(normalized)) {
            return reponseSurcharges();
        }

        if (isStatsQuestion(normalized)) {
            return reponseStatsGlobales();
        }

        return reponseAnthropicAvecContexte(question);
    }

    private String reponseDisponibilites() {
        List<Collaborateur> disponibles = collaborateurRepository.findByRoleIgnoreCaseAndDisponibleTrue("COLLAB");

        if (disponibles.isEmpty()) {
            return "Aucun collaborateur disponible actuellement.";
        }

        String details = disponibles.stream()
            .map(c -> String.format("- %s %s", safe(c.getPrenom()), safe(c.getNom())).trim())
            .collect(Collectors.joining("\n"));

        return "Collaborateurs disponibles :\n" + details;
    }

    private String reponseSurcharges() {
        Map<Long, Long> activeCounts = countActiveAssignmentsByCollaborateur();

        List<Collaborateur> surcharges = collaborateurRepository.findByRoleIgnoreCase("COLLAB").stream()
            .filter(c -> activeCounts.getOrDefault(c.getId(), 0L) > 2)
            .toList();

        if (surcharges.isEmpty()) {
            return "Aucun collaborateur avec plus de 2 affectations actives.";
        }

        String details = surcharges.stream()
            .map(c -> String.format("- %s %s (%d affectations actives)",
                safe(c.getPrenom()),
                safe(c.getNom()),
                activeCounts.getOrDefault(c.getId(), 0L)
            ).trim())
            .collect(Collectors.joining("\n"));

        return "Collaborateurs surchargés :\n" + details;
    }

    private String reponseStatsGlobales() {
        List<Collaborateur> collaborateurs = collaborateurRepository.findByRoleIgnoreCase("COLLAB");
        List<Projet> projets = projetRepository.findAll();
        Map<Long, Long> activeCounts = countActiveAssignmentsByCollaborateur();

        long nbProjetsActifs = projets.stream().filter(this::isProjetActif).count();
        long nbCollaborateursDisponibles = collaborateurs.stream().filter(Collaborateur::isDisponible).count();
        long totalCollabs = collaborateurs.size();
        long nbCollaborateursSurcharges = collaborateurs.stream()
            .filter(c -> activeCounts.getOrDefault(c.getId(), 0L) > 2)
            .count();

        // ✅ CORRECTION : collabs ayant au moins 1 affectation active / total collabs COLLAB
        long nbCollabsAffectes = collaborateurs.stream()
            .filter(c -> activeCounts.getOrDefault(c.getId(), 0L) > 0)
            .count();

        long tauxAffectation = totalCollabs == 0 ? 0
            : Math.round((nbCollabsAffectes * 100.0) / totalCollabs);

        return String.format(
            Locale.ROOT,
            "Stats globales : nb_projets_actifs=%d, nb_collaborateurs_disponibles=%d, nb_collaborateurs_surcharges=%d, taux_affectation=%d%%",
            nbProjetsActifs,
            nbCollaborateursDisponibles,
            nbCollaborateursSurcharges,
            tauxAffectation
        );
    }

    private String reponseAnthropicAvecContexte(String question) {
        if (anthropicApiKey == null || anthropicApiKey.isBlank()) {
            return "Question reçue, mais la clé Anthropic n'est pas configurée côté backend (anthropic.api.key).";
        }

        try {
            String contexte = buildContexteData();

            Map<String, Object> payload = new HashMap<>();
            payload.put("model", anthropicModel);
            payload.put("max_tokens", 500);
            payload.put("temperature", 0.2);

            Map<String, Object> message = new HashMap<>();
            message.put("role", "user");
            message.put("content",
                "Tu es un assistant manager SmartAssign. Réponds en français, concis et exploitable.\n\n"
                + "Contexte BDD:\n" + contexte + "\n\n"
                + "Question manager:\n" + question
            );
            payload.put("messages", List.of(message));

            String requestBody = objectMapper.writeValueAsString(payload);

            HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(anthropicApiUrl))
                .timeout(Duration.ofSeconds(30))
                .header("Content-Type", "application/json")
                .header("x-api-key", anthropicApiKey)
                .header("anthropic-version", "2023-06-01")
                .POST(HttpRequest.BodyPublishers.ofString(requestBody))
                .build();

            HttpResponse<String> response = HttpClient.newHttpClient()
                .send(request, HttpResponse.BodyHandlers.ofString());

            if (response.statusCode() < 200 || response.statusCode() >= 300) {
                LOGGER.warn("Anthropic error status {}: {}", response.statusCode(), response.body());
                return "Analyse IA indisponible pour le moment (erreur fournisseur IA).";
            }

            JsonNode root = objectMapper.readTree(response.body());
            JsonNode content = root.path("content");
            if (content.isArray() && !content.isEmpty()) {
                JsonNode first = content.get(0);
                String text = first.path("text").asText("").trim();
                if (!text.isBlank()) {
                    return text;
                }
            }

            return "Analyse IA terminée, mais la réponse est vide.";
        } catch (IOException | InterruptedException ex) {
            LOGGER.error("Erreur appel Anthropic", ex);
            return "Analyse IA indisponible pour le moment (erreur technique).";
        }
    }

    private Map<Long, Long> countActiveAssignmentsByCollaborateur() {
        List<Affectation> affectations = affectationRepository.findAll();

        return affectations.stream()
            .filter(a -> a.getCollaborateur() != null)
            .filter(a -> a.getProjet() != null)
            .filter(a -> isProjetActif(a.getProjet()))
            .collect(Collectors.groupingBy(a -> a.getCollaborateur().getId(), Collectors.counting()));
    }

    private boolean isProjetActif(Projet projet) {
        String statut = normalize(projet.getStatut());
        return !"termine".equals(statut) && !"annule".equals(statut);
    }

    private String buildContexteData() {
        List<Projet> projets = projetRepository.findAll();
        List<Collaborateur> collaborateurs = collaborateurRepository.findByRoleIgnoreCase("COLLAB");
        Map<Long, Long> activeCounts = countActiveAssignmentsByCollaborateur();
        Set<Long> idsDisponibles = collaborateurs.stream()
            .filter(Collaborateur::isDisponible)
            .map(Collaborateur::getId)
            .collect(Collectors.toSet());

        long projetsActifs = projets.stream().filter(this::isProjetActif).count();

        String topCharges = collaborateurs.stream()
            .sorted((a, b) -> Long.compare(activeCounts.getOrDefault(b.getId(), 0L), activeCounts.getOrDefault(a.getId(), 0L)))
            .limit(5)
            .map(c -> String.format("%s %s:%d", safe(c.getPrenom()), safe(c.getNom()), activeCounts.getOrDefault(c.getId(), 0L)))
            .collect(Collectors.joining(", "));

        return String.format(
            Locale.ROOT,
            "projets_actifs=%d; collaborateurs_total=%d; collaborateurs_disponibles=%d; top_charge=[%s]",
            projetsActifs,
            collaborateurs.size(),
            idsDisponibles.size(),
            topCharges
        );
    }

    private String normalize(String input) {
        return input == null ? "" : input.trim().toLowerCase(Locale.ROOT);
    }

    private String safe(String input) {
        return input == null ? "" : input.trim();
    }

    private boolean isDisponibiliteQuestion(String q) {
        return q.contains("qui est disponible") || q.contains("disponible") || q.contains("disponibles");
    }

    private boolean isSurchargeQuestion(String q) {
        return q.contains("surcharge") || q.contains("surcharg") || q.contains("surcharges") || q.contains("surcharges ?") || q.contains("surchargés") || q.contains("surcharges");
    }

    private boolean isStatsQuestion(String q) {
        return q.contains("stats globales") || q.contains("stats") || q.contains("statistiques globales");
    }
}