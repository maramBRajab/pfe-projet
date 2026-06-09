package com.smartassign.pfe.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class ManagerIaAnalyseRequest {

    @NotBlank(message = "La question est obligatoire")
    private String question;
}
