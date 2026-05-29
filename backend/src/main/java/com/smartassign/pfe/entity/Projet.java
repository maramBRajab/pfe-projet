package com.smartassign.pfe.entity;

import java.time.LocalDate;
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
@Table(name = "projets")
public class Projet {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @NotBlank(message = "Le nom du projet est obligatoire")
    private String nom;

    @NotBlank(message = "La description est obligatoire")
    @Column(columnDefinition = "TEXT")
    private String description;

    @NotNull(message = "La date de début est obligatoire")
    private LocalDate dateDebut;

    @NotNull(message = "La date de fin est obligatoire")
    private LocalDate dateFin;

    @Builder.Default
    private String statut = "en_attente";
    // valeurs : "en_attente" | "en_cours" | "termine"

    @ManyToMany(fetch = FetchType.EAGER)
    @JoinTable(
        name = "projet_competences",
        joinColumns = @JoinColumn(name = "projet_id"),
        inverseJoinColumns = @JoinColumn(name = "competence_id")
    )
    @Builder.Default
    private Set<Competence> competencesRequises = new HashSet<>();

    @AssertTrue(message = "La date de fin doit être après la date de début")
    public boolean isDateRangeValid() {
        if (dateDebut == null || dateFin == null) return true;
        return !dateFin.isBefore(dateDebut);
    }
}