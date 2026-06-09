package com.smartassign.pfe.repository;

import java.util.List;
import java.time.LocalDateTime;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import com.smartassign.pfe.entity.Affectation;

@Repository
public interface AffectationRepository extends JpaRepository<Affectation, Long> {

    interface CollaborateurAffectationRow {
        Long getId();
        String getProjet();
        Double getScore();
        LocalDateTime getDateAffectation();
        String getStatut();
        String getManagerNom();
    }

    interface OverloadedCollaborateurRow {
        Long getId();
        String getPrenom();
        String getNom();
        Long getActiveAssignments();
    }

    List<Affectation> findByProjetId(Long projetId);

    List<Affectation> findByCollaborateurId(Long collaborateurId);

    boolean existsByProjetIdAndCollaborateurId(Long projetId, Long collaborateurId);

    @Query("SELECT a FROM Affectation a ORDER BY a.dateAffectation DESC")
    List<Affectation> findAllOrderByDateDesc();

    @Query("SELECT a FROM Affectation a WHERE a.projet.id = :projetId ORDER BY a.score DESC")
    List<Affectation> findByProjetIdOrderByScoreDesc(Long projetId);

    // Compte toutes les affectations restantes quel que soit le statut du projet
    // (sauf projets terminés/annulés). Utilisé pour la synchro disponibilité.
    @Query(value = """
        SELECT COUNT(*)
        FROM affectations a
        JOIN projets p ON p.id = a.projet_id
        WHERE a.collaborateur_id = :collaborateurId
          AND LOWER(COALESCE(p.statut, '')) NOT IN ('termine', 'annule', 'suspendu')
        """, nativeQuery = true)
    int countAffectationsNonTerminees(@Param("collaborateurId") Long collaborateurId);

    @Query(value = """
        SELECT COUNT(*)
        FROM affectations a
        JOIN projets p ON p.id = a.projet_id
        WHERE a.collaborateur_id = :collaborateurId
                    AND LOWER(COALESCE(p.statut, '')) IN ('en_cours', 'active')
        """, nativeQuery = true)
    int countProjetsActifs(@Param("collaborateurId") Long collaborateurId);

    @Query(value = """
        SELECT COUNT(*)
        FROM affectations a
        JOIN projets p ON p.id = a.projet_id
        WHERE a.collaborateur_id = :collaborateurId
          AND LOWER(COALESCE(p.statut, '')) = 'termine'
        """, nativeQuery = true)
    int countProjetsTermines(@Param("collaborateurId") Long collaborateurId);

    @Query(value = """
        SELECT COALESCE(AVG(a.score), 0)
        FROM affectations a
                JOIN projets p ON p.id = a.projet_id
        WHERE a.collaborateur_id = :collaborateurId
                    AND LOWER(COALESCE(p.statut, '')) IN ('en_cours', 'active')
        """, nativeQuery = true)
    Double getChargeActuelle(@Param("collaborateurId") Long collaborateurId);

    @Query(value = """
        SELECT COUNT(DISTINCT a.collaborateur_id)
        FROM affectations a
        JOIN projets p ON p.id = a.projet_id
        WHERE a.collaborateur_id IS NOT NULL
          AND LOWER(COALESCE(p.statut, '')) NOT IN ('termine', 'annule')
        """, nativeQuery = true)
    long countDistinctCollaborateursActifs();

    @Query("""
        SELECT COUNT(DISTINCT a.collaborateur.id) FROM Affectation a
        WHERE a.projet.managerId = :managerId
          AND LOWER(COALESCE(a.projet.statut, '')) NOT IN ('termine', 'annule', 'suspendu')
        """)
    long countDistinctCollaborateurActifsByManager(@Param("managerId") Long managerId);

    @Query("""
        SELECT COUNT(a) FROM Affectation a
        WHERE a.projet.managerId = :managerId
          AND LOWER(COALESCE(a.projet.statut, '')) NOT IN ('termine', 'annule', 'suspendu')
        """)
    long countActiveAffectationsByManager(@Param("managerId") Long managerId);

    @Query("""
        SELECT COALESCE(AVG(a.score), 0) FROM Affectation a
        WHERE a.projet.managerId = :managerId
        """)
    double getAverageScoreByManager(@Param("managerId") Long managerId);

    @Query(value = """
        SELECT COUNT(DISTINCT a.collaborateur_id)
        FROM affectations a
        JOIN projets p ON p.id = a.projet_id
        JOIN collaborateurs c ON c.id = a.collaborateur_id
        WHERE a.collaborateur_id IS NOT NULL
          AND UPPER(TRIM(COALESCE(c.role, ''))) = 'COLLAB'
          AND LOWER(COALESCE(p.statut, '')) NOT IN ('termine', 'annule', 'suspendu')
        """, nativeQuery = true)
    long countDistinctCollaborateurCandidatsActifs();

    @Query(value = """
        SELECT COUNT(*)
        FROM affectations a
        JOIN projets p ON p.id = a.projet_id
        WHERE LOWER(COALESCE(p.statut, '')) NOT IN ('termine', 'annule', 'suspendu')
        """, nativeQuery = true)
    long countActiveAffectations();

    @Query(value = """
        SELECT COALESCE(AVG(a.score), 0)
        FROM affectations a
        """, nativeQuery = true)
    double getAverageScoreGlobal();

    @Query(value = """
        SELECT COUNT(*)
        FROM (
            SELECT a.collaborateur_id
            FROM affectations a
            JOIN projets p ON p.id = a.projet_id
            WHERE a.collaborateur_id IS NOT NULL
              AND LOWER(COALESCE(p.statut, '')) NOT IN ('termine', 'annule', 'suspendu')
            GROUP BY a.collaborateur_id
            HAVING COUNT(*) > 1
        ) overloaded
        """, nativeQuery = true)
    long countOverloadedCollaborateurs();

    @Query(value = """
        SELECT c.id AS id,
               c.prenom AS prenom,
               c.nom AS nom,
               COUNT(*) AS activeAssignments
        FROM affectations a
        JOIN projets p ON p.id = a.projet_id
        JOIN collaborateurs c ON c.id = a.collaborateur_id
        WHERE LOWER(COALESCE(p.statut, '')) NOT IN ('termine', 'annule', 'suspendu')
        GROUP BY c.id, c.prenom, c.nom
        HAVING COUNT(*) > 1
        ORDER BY COUNT(*) DESC, c.nom ASC
        """, nativeQuery = true)
    List<OverloadedCollaborateurRow> findOverloadedCollaborateurs();

    @Query("""
        SELECT a
        FROM Affectation a
        WHERE a.collaborateur.id = :collaborateurId
            AND LOWER(COALESCE(a.projet.statut, '')) IN ('en_cours', 'active')
        ORDER BY a.dateAffectation DESC
        """)
    List<Affectation> findActiveByCollaborateurId(@Param("collaborateurId") Long collaborateurId);

    @Query(value = """
        SELECT a.id AS id,
               p.nom AS projet,
               a.score AS score,
               a.date_affectation AS dateAffectation,
               p.statut AS statut,
               u.nom AS managerNom
        FROM affectations a
        JOIN projets p ON p.id = a.projet_id
        LEFT JOIN utilisateurs u ON u.id = p.manager_id
        WHERE a.collaborateur_id = :collaborateurId
        ORDER BY a.date_affectation DESC
        """, nativeQuery = true)
    List<CollaborateurAffectationRow> findCollaborateurAffectationRows(@Param("collaborateurId") Long collaborateurId);
}