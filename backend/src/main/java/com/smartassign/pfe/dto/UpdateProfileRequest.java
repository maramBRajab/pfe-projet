package com.smartassign.pfe.dto;
import lombok.Data;

@Data
public class UpdateProfileRequest {
    private String nom;
    private String email;
    private String telephone;
    private String poste;
    private String departement;
}
