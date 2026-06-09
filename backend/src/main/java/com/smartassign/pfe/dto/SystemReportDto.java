package com.smartassign.pfe.dto;

import lombok.Builder;
import lombok.Data;

import java.util.List;

@Data
@Builder
public class SystemReportDto {

    private ComptesCreesDto comptesCrees;
    private ConnexionsDto connexions;
    private AffectationDto affectation;
    private ProjetsDto projets;
    private SanteSystemeDto santeSysteme;
    private List<EvolutionMoisDto> evolutionComptes;
    private List<RepartitionDeptDto> repartitionDepartement;

    @Data @Builder
    public static class ComptesCreesDto {
        private long total;
        private long ceMois;
        private long moisDernier;
        private long suspendus;
    }

    @Data @Builder
    public static class ConnexionsDto {
        private long actives;
        private double evolution;
    }

    @Data @Builder
    public static class AffectationDto {
        private int tauxGlobal;
        private int cible;
    }

    @Data @Builder
    public static class ProjetsDto {
        private long total;
        private long enCours;
        private long enAttente;
        private long termines;
    }

    @Data @Builder
    public static class SanteSystemeDto {
        private double uptimePlateforme;
        private int tauxAffectation;
        private double tauxProjetsActifs;
        private double tauxCollaborateursAffectes;
        private int comptesAvecCompetences;
    }

    @Data @Builder
    public static class EvolutionMoisDto {
        private String mois;
        private long count;
    }

    @Data @Builder
    public static class RepartitionDeptDto {
        private String departement;
        private long count;
    }
}
