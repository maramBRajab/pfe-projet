package com.smartassign.pfe.dto;

import java.time.LocalDate;
import java.util.Set;

import com.fasterxml.jackson.annotation.JsonIgnore;

import jakarta.validation.constraints.*;
import jakarta.validation.constraints.AssertTrue;
import lombok.*;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ProjetRequest {

    @NotBlank(message = "Le nom est obligatoire")
    private String nom;

    @NotBlank(message = "La description est obligatoire")
    private String description;

    @NotNull(message = "La date de début est obligatoire")
    private LocalDate dateDebut;

    @NotNull(message = "La date de fin est obligatoire")
    private LocalDate dateFin;

    @Builder.Default
    private String statut = "en_attente";

    private Set<Long> competenceIds;

    @JsonIgnore
    @AssertTrue(message = "La date de fin doit etre apres ou egale a la date de debut")
    public boolean isDateRangeValid() {
        if (dateDebut == null || dateFin == null) {
            return true;
        }
        return !dateFin.isBefore(dateDebut);
    }
}