package com.smartassign.pfe.repository;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import com.smartassign.pfe.entity.Affectation;

@Repository
public interface AffectationRepository extends JpaRepository<Affectation, Long> {

    List<Affectation> findByProjetId(Long projetId);

    List<Affectation> findByCollaborateurId(Long collaborateurId);

    boolean existsByProjetIdAndCollaborateurId(Long projetId, Long collaborateurId);

    @Query("SELECT a FROM Affectation a ORDER BY a.dateAffectation DESC")
    List<Affectation> findAllOrderByDateDesc();

    @Query("SELECT a FROM Affectation a WHERE a.projet.id = :projetId ORDER BY a.score DESC")
    List<Affectation> findByProjetIdOrderByScoreDesc(Long projetId);
}