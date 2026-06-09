package com.smartassign.pfe.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Entity
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@Table(name = "disponibilites_utilisateurs")
public class DisponibiliteUtilisateur {

    @Id
    @Column(name = "user_id")
    private Long userId;

    @Column(nullable = false)
    private String statut;
}