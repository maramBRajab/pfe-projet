package com.smartassign.pfe.repository;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import com.smartassign.pfe.entity.Conge;

@Repository
public interface CongeRepository extends JpaRepository<Conge, Long> {

    List<Conge> findByCollaborateurIdOrderByDateDebutAsc(Long collaborateurId);

    Optional<Conge> findByCollaborateurIdAndLibelleIgnoreCase(Long collaborateurId, String libelle);
}