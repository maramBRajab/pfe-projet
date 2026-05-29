package com.smartassign.pfe.dto;

import jakarta.validation.constraints.*;
import lombok.*;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class AuthRequest {

    @NotBlank(message = "L'email est obligatoire")
    @Email
    private String email;

    @NotBlank(message = "Le mot de passe est obligatoire")
    private String motDePasse;
}