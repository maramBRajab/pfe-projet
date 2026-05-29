package com.smartassign.pfe.repository;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import com.smartassign.pfe.entity.Projet;

@Repository
public interface ProjetRepository extends JpaRepository<Projet, Long> {

    List<Projet> findByStatut(String statut);

    List<Projet> findByNomContainingIgnoreCase(String nom);

    boolean existsByNom(String nom);
}