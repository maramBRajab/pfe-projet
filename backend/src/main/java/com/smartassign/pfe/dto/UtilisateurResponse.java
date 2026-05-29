package com.smartassign.pfe.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class UtilisateurResponse {
    private Long id;
    private String nom;
    private String email;
    private String role;
}