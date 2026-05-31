package com.smartassign.pfe.dto;
import lombok.Data;

@Data
public class ChangePasswordRequest {
    private String motDePasseActuel;
    private String nouveauMotDePasse;
    private String confirmationMotDePasse;
}
