package com.smartassign.pfe.entity;

import java.time.LocalDate;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Entity
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@Table(name = "taches")
public class Tache {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @NotBlank(message = "Le titre de la tache est obligatoire")
    private String titre;

    @Column(columnDefinition = "TEXT")
    private String description;

    @NotNull(message = "La date d'echeance est obligatoire")
    private LocalDate dateEcheance;

    @Builder.Default
    private String statut = "A_FAIRE";

    @Builder.Default
    private String priorite = "MOYENNE";

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "collaborateur_id", nullable = false)
    private Collaborateur collaborateur;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "projet_id")
    private Projet projet;
}