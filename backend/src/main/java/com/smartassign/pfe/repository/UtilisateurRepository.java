package com.smartassign.pfe.repository;

import java.time.LocalDateTime;
import java.util.Optional;
import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import com.smartassign.pfe.entity.Utilisateur;

@Repository
public interface UtilisateurRepository extends JpaRepository<Utilisateur, Long> {

    Optional<Utilisateur> findByEmail(String email);

    Optional<Utilisateur> findByEmailIgnoreCase(String email);

    boolean existsByEmail(String email);

    boolean existsByEmailIgnoreCase(String email);

    List<Utilisateur> findByRoleIgnoreCase(String role);

    long countByCreatedAtBetween(LocalDateTime from, LocalDateTime to);

    Optional<Utilisateur> findByIdAndRoleIgnoreCase(Long id, String role);

        @Query("""
                SELECT TRIM(u.departement), COUNT(u)
                FROM Utilisateur u
                WHERE UPPER(u.role) = 'COLLAB'
                    AND u.departement IS NOT NULL
                    AND TRIM(u.departement) <> ''
                    AND UPPER(TRIM(u.departement)) <> 'NON RENSEIGNE'
                    AND UPPER(TRIM(u.departement)) <> 'NON RENSEIGNÉ'
                GROUP BY TRIM(u.departement)
                ORDER BY COUNT(u) DESC, TRIM(u.departement) ASC
                """)
        List<Object[]> countCollaborateursByDepartementForReport();
}