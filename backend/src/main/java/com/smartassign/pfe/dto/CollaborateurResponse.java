package com.smartassign.pfe.dto;

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
    private String  role;
    private String  motDePasseGenere;
    private int     experienceAnnees;
    private boolean disponible;
    private Set<CompetenceResponse> competences;
}