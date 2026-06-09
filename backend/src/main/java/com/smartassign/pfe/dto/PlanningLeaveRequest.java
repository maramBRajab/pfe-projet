package com.smartassign.pfe.dto;

import java.time.LocalDate;

import jakarta.validation.constraints.AssertTrue;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

@Data
public class PlanningLeaveRequest {

    @NotBlank(message = "Le libelle du conge est obligatoire")
    private String libelle;

    @NotBlank(message = "Le type du conge est obligatoire")
    private String type;

    @NotNull(message = "La date de debut est obligatoire")
    private LocalDate dateDebut;

    @NotNull(message = "La date de fin est obligatoire")
    private LocalDate dateFin;

    private String impactDisponibilite = "INDISPONIBLE";

    @AssertTrue(message = "La date de fin doit etre apres la date de debut")
    public boolean isDateRangeValid() {
        if (dateDebut == null || dateFin == null) {
            return true;
        }
        return !dateFin.isBefore(dateDebut);
    }
}
