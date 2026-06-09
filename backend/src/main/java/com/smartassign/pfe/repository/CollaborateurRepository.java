package com.smartassign.pfe.repository;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import com.smartassign.pfe.entity.Collaborateur;

@Repository
public interface CollaborateurRepository extends JpaRepository<Collaborateur, Long> {

    Optional<Collaborateur> findByEmail(String email);

    Optional<Collaborateur> findByEmailIgnoreCase(String email);

    boolean existsByEmail(String email);

    boolean existsByEmailIgnoreCase(String email);

    List<Collaborateur> findByDisponibleTrue();

        @Query("""
            SELECT COUNT(c)
            FROM Collaborateur c
            WHERE UPPER(TRIM(c.role)) = 'COLLAB'
            """)
        long countCollaborateurCandidates();

        @Query("""
            SELECT COUNT(c)
            FROM Collaborateur c
            WHERE c.disponible = true
            AND UPPER(TRIM(c.role)) = 'COLLAB'
            """)
        long countAvailableCollaborateurCandidates();

        @Query("""
                SELECT c
                FROM Collaborateur c
                WHERE c.disponible = true
                    AND UPPER(TRIM(c.role)) = 'COLLAB'
                """)
        List<Collaborateur> findAvailableCollaborateurCandidates();

    List<Collaborateur> findByDisponibleFalse();

    List<Collaborateur> findByRoleIgnoreCase(String role);

    long countByRoleIgnoreCase(String role);

    List<Collaborateur> findByRoleIgnoreCaseAndDisponibleTrue(String role);

    @Query("SELECT c FROM Collaborateur c JOIN c.competences comp WHERE comp.id IN :competenceIds")
    List<Collaborateur> findByCompetenceIds(List<Long> competenceIds);

    @Query(value = """
        SELECT COUNT(*)
        FROM collaborateur_competences cc
        WHERE cc.collaborateur_id = :collaborateurId
        """, nativeQuery = true)
    long countCompetencesByCollaborateurId(@Param("collaborateurId") Long collaborateurId);
}