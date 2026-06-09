package com.smartassign.pfe.repository;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import com.smartassign.pfe.entity.Tache;

@Repository
public interface TacheRepository extends JpaRepository<Tache, Long> {

    List<Tache> findByCollaborateurIdOrderByDateEcheanceAsc(Long collaborateurId);

    @Query("""
        SELECT t
        FROM Tache t
        LEFT JOIN FETCH t.projet p
        WHERE t.collaborateur.id = :collaborateurId
          AND (:dateDebut IS NULL OR t.dateEcheance >= :dateDebut)
          AND (:dateFin IS NULL OR t.dateEcheance <= :dateFin)
        ORDER BY t.dateEcheance ASC
        """)
    List<Tache> findByCollaborateurIdAndDateRange(
        @Param("collaborateurId") Long collaborateurId,
        @Param("dateDebut") LocalDate dateDebut,
        @Param("dateFin") LocalDate dateFin
    );

    List<Tache> findByProjetId(Long projetId);

    Optional<Tache> findByCollaborateurIdAndTitreIgnoreCase(Long collaborateurId, String titre);

    @Query("""
        SELECT t
        FROM Tache t
        WHERE t.collaborateur.id = :collaborateurId
          AND t.dateEcheance >= :today
          AND UPPER(COALESCE(t.statut, 'A_FAIRE')) <> 'TERMINEE'
        ORDER BY t.dateEcheance ASC
        """)
    List<Tache> findUpcomingByCollaborateurId(
        @Param("collaborateurId") Long collaborateurId,
        @Param("today") LocalDate today
    );

    @Query("""
        SELECT t
        FROM Tache t
        LEFT JOIN FETCH t.projet p
        WHERE t.collaborateur.id = :collaborateurId
        ORDER BY t.dateEcheance ASC
        """)
    List<Tache> getTachesForMesProjets(@Param("collaborateurId") Long collaborateurId);

        @Query(value = """
                SELECT *
                FROM taches t
                WHERE t.collaborateur_id = :collaborateurId
                    AND LOWER(COALESCE(t.priorite, '')) = 'critique'
                    AND LOWER(COALESCE(t.statut, '')) <> 'termine'
                ORDER BY t.date_echeance ASC
                """, nativeQuery = true)
        List<Tache> findCriticalNotifications(@Param("collaborateurId") Long collaborateurId);

        @Query(value = """
                SELECT *
                FROM taches t
                WHERE t.collaborateur_id = :collaborateurId
                    AND t.date_echeance < (CURRENT_TIMESTAMP + INTERVAL '3 day')
                    AND LOWER(COALESCE(t.statut, '')) <> 'termine'
                ORDER BY t.date_echeance ASC
                """, nativeQuery = true)
        List<Tache> findVigilanceTaskNotifications(@Param("collaborateurId") Long collaborateurId);
}