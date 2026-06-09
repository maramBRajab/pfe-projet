package com.smartassign.pfe.dto;

import java.util.List;

public final class AdminDashboardDto {

    private AdminDashboardDto() {
    }

    public record DashboardStats(
        long projetsActifs,
        long totalProjets,
        long totalCollaborateurs,
        long tauxAffectation,
        long managersActifs,
        long totalManagers,
        long projetsEnRetard,
        long ressourcesDisponibles,
        long nouveauxProjets,
        long nouveauxCollabs
    ) {
    }

    public record EvolutionMois(String mois, long actifs, long termines) {
    }

    public record RepartitionRoles(long collaborateurs, long managers, long admins) {
    }

    public record Alerte(
        String type,
        String icon,
        String message,
        String time,
        String title,
        String description,
        String level,
        String generatedAt,
        String link
    ) {
    }

    public record Activite(
        String initiales,
        String action,
        String temps,
        String categorie,
        String createdAt,
        String role,
        String level,
        String type,
        String userEmail,
        String ip
    ) {
    }

    public record DashboardInsights(
        PlatformHealth platformHealth,
        List<CriticalProject> criticalProjects,
        List<UpcomingDeadline> upcomingDeadlines,
        List<CollaboratorLoad> collaboratorLoad,
        List<Suggestion> suggestions
    ) {
    }

    public record PlatformHealth(
        int score,
        String label,
        String summary,
        String tone,
        List<HealthFactor> factors
    ) {
    }

    public record HealthFactor(String label, int score, String tone, String detail) {
    }

    public record CriticalProject(
        Long id,
        String nom,
        String manager,
        String statut,
        int charge,
        int assignmentCount,
        double averageScore,
        long daysLeft,
        String risk,
        String recommendation,
        String link,
        String tone
    ) {
    }

    public record UpcomingDeadline(
        Long id,
        String nom,
        String owner,
        String dueLabel,
        long daysLeft,
        String tone,
        String link
    ) {
    }

    public record CollaboratorLoad(
        Long id,
        String name,
        String role,
        int load,
        int assignmentCount,
        int activeProjects,
        String availabilityLabel,
        String skills,
        String tone,
        String link
    ) {
    }

    public record Suggestion(
        String title,
        String detail,
        String actionLabel,
        String link,
        String tone
    ) {
    }

    public record SearchResult(
        String type,
        String title,
        String subtitle,
        String link
    ) {
    }
}