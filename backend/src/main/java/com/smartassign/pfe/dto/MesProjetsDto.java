package com.smartassign.pfe.dto;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class MesProjetsDto {

    private int projetsActifs;
    private double chargeActuelle;
    private double compatibiliteMoyenne;
    private int projetsTermines;
    private List<TacheDto> taches;
    private List<JalonDto> jalons;

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class TacheDto {
        private Long id;
        private String titre;
        private String statut;
        private String priorite;
        private LocalDate dateEcheance;
        private Long projetId;
        private String projetNom;
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class JalonDto {
        private String titre;
        private LocalDateTime date;
        private String statut;
        private String description;
    }
}
