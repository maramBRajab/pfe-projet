package com.smartassign.pfe.repository;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import com.smartassign.pfe.entity.Tache;

@Repository
public interface TacheRepository extends JpaRepository<Tache, Long> {

    List<Tache> findByCollaborateurIdOrderByDateEcheanceAsc(Long collaborateurId);

    List<Tache> findByProjetId(Long projetId);

    Optional<Tache> findByCollaborateurIdAndTitreIgnoreCase(Long collaborateurId, String titre);
}