package com.smartassign.pfe.entity;

import java.time.LocalDateTime;

import jakarta.persistence.*;
import lombok.*;

@Entity
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@Table(name = "affectations")
public class Affectation {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "projet_id", nullable = false)
    private Projet projet;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "collaborateur_id", nullable = false)
    private Collaborateur collaborateur;

    private double score;

    @Builder.Default
    @Column(nullable = false, length = 50)
    private String statut = "EN_ATTENTE";

    @Builder.Default
    @Column(nullable = false, length = 32)
    private String potentiel = "À confirmer";

    @Builder.Default
    private LocalDateTime dateAffectation = LocalDateTime.now();

    // Constructeur utilitaire pour l'algorithme
    public Affectation(Projet projet, Collaborateur collaborateur, double score) {
        this.projet          = projet;
        this.collaborateur   = collaborateur;
        this.score           = score;
        this.statut          = "EN_ATTENTE";
        this.potentiel       = "À confirmer";
        this.dateAffectation = LocalDateTime.now();
    }
}