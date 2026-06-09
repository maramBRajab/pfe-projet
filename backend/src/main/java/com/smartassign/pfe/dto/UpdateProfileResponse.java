package com.smartassign.pfe.dto;
import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class UpdateProfileResponse {
    private Long id;
    private String nom;
    private String email;
    private String role;
    private String photoUrl;
    private String telephone;
    private String poste;
    private String departement;
}
