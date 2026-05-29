package com.smartassign.pfe.entity;

import java.time.LocalDate;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import jakarta.validation.constraints.AssertTrue;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Entity
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@Table(name = "conges")
public class Conge {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @NotBlank(message = "Le libelle du conge est obligatoire")
    private String libelle;

    @NotBlank(message = "Le type du conge est obligatoire")
    private String type;

    @NotNull(message = "La date de debut est obligatoire")
    private LocalDate dateDebut;

    @NotNull(message = "La date de fin est obligatoire")
    private LocalDate dateFin;

    @Builder.Default
    @Column(name = "impact_disponibilite")
    private String impactDisponibilite = "INDISPONIBLE";

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "collaborateur_id", nullable = false)
    private Collaborateur collaborateur;

    @AssertTrue(message = "La date de fin doit etre apres la date de debut")
    public boolean isDateRangeValid() {
        if (dateDebut == null || dateFin == null) {
            return true;
        }
        return !dateFin.isBefore(dateDebut);
    }
}