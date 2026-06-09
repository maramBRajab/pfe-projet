package com.smartassign.pfe.entity;

import java.util.HashSet;
import java.util.Set;

import jakarta.persistence.*;
import jakarta.validation.constraints.*;
import lombok.*;

@Entity
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@Table(name = "collaborateurs")
public class Collaborateur {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @NotBlank(message = "Le nom est obligatoire")
    private String nom;

    @NotBlank(message = "Le prénom est obligatoire")
    private String prenom;

    @NotBlank(message = "L'email est obligatoire")
    @Email(message = "L'email est invalide")
    @Column(unique = true)
    private String email;

    private String telephone;

    @Builder.Default
    private String role = "COLLAB";

    private String departement;

    @Min(value = 0, message = "L'expérience doit être positive")
    private int experienceAnnees;

    @Builder.Default
    private boolean disponible = true;

    @Column(name = "photo_url", columnDefinition = "TEXT")
    private String photoUrl;

    @ManyToMany(fetch = FetchType.EAGER)
    @JoinTable(
        name = "collaborateur_competences",
        joinColumns = @JoinColumn(name = "collaborateur_id"),
        inverseJoinColumns = @JoinColumn(name = "competence_id")
    )
    @Builder.Default
    private Set<Competence> competences = new HashSet<>();
}