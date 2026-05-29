package com.smartassign.pfe.repository;

import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import com.smartassign.pfe.entity.Competence;

@Repository
public interface CompetenceRepository extends JpaRepository<Competence, Long> {

    Optional<Competence> findByNomIgnoreCase(String nom);

    boolean existsByNomIgnoreCase(String nom);
}