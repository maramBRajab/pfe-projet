package com.smartassign.pfe.dto;

import lombok.*;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class AuthResponse {
    private Long   id;
    private String nom;
    private String email;
    private String role;
    private String photoUrl;
    private String telephone;
    private String poste;
    private String departement;
    private String token; // pour JWT plus tard
}