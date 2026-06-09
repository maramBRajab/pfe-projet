package com.smartassign.pfe.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class TaskStatusUpdateRequest {

    @NotBlank(message = "Le statut de la tache est obligatoire")
    private String statut;
}
