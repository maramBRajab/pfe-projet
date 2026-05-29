package com.smartassign.pfe.repository;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import com.smartassign.pfe.entity.Collaborateur;

@Repository
public interface CollaborateurRepository extends JpaRepository<Collaborateur, Long> {

    Optional<Collaborateur> findByEmail(String email);

    Optional<Collaborateur> findByEmailIgnoreCase(String email);

    boolean existsByEmail(String email);

    boolean existsByEmailIgnoreCase(String email);

    List<Collaborateur> findByDisponibleTrue();

    List<Collaborateur> findByDisponibleFalse();

    @Query("SELECT c FROM Collaborateur c JOIN c.competences comp WHERE comp.id IN :competenceIds")
    List<Collaborateur> findByCompetenceIds(List<Long> competenceIds);
}