package com.smartassign.pfe.dto;

import java.time.LocalDateTime;
import java.util.Set;
import lombok.*;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class CollaborateurResponse {
    private Long    id;
    private String  nom;
    private String  prenom;
    private String  email;
    private String  telephone;
    private String  photoUrl;
    private String  role;
    private String  departement;
    private String  motDePasseGenere;
    private boolean emailEnvoye;
    private String  emailErreur;
    private boolean emailVerifie;
    private LocalDateTime emailVerifieLe;
    private String  statutVerificationEmail;
    private boolean verificationEmailEnvoye;
    private String  verificationEmailErreur;
    private String  statutCompte;
    private int     experienceAnnees;
    private boolean disponible;
    private Set<CompetenceResponse> competences;
}