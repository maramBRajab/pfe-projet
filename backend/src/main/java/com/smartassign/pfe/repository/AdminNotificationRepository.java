package com.smartassign.pfe.repository;

import java.time.LocalDateTime;
import java.time.LocalDate;
import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import com.smartassign.pfe.entity.AdminNotification;

@Repository
public interface AdminNotificationRepository extends JpaRepository<AdminNotification, Long> {

    interface NotificationRow {
        Long getId();
        String getType();
        String getTitre();
        String getDescription();
        Boolean getIsRead();
        LocalDateTime getCreatedAt();
        LocalDateTime getUpdatedAt();
        Long getProjetId();
        String getProjetNom();
    }

    interface NotificationMutationRow {
        Long getId();
        String getType();
        String getTitre();
        String getDescription();
        Boolean getIsRead();
        LocalDateTime getCreatedAt();
        LocalDateTime getUpdatedAt();
        Long getProjetId();
    }

    interface ProjectWithoutManagerRow {
        Long getId();
        String getNom();
        LocalDate getDateFin();
        String getStatut();
    }

    interface ProjectLateRow {
        Long getId();
        String getNom();
        LocalDate getDateFin();
        String getStatut();
    }

    interface ProjectExpiringRow {
        Long getId();
        String getNom();
        LocalDate getDateFin();
    }

    interface OverloadedCollaboratorRow {
        Long getId();
        String getPrenom();
        String getNom();
        Long getNbProjets();
    }

    @Query(value = """
        SELECT
            n.id AS id,
            n.type AS type,
            n.titre AS titre,
            n.description AS description,
            n.is_read AS isRead,
            n.created_at AS createdAt,
            n.updated_at AS updatedAt,
            n.projet_id AS projetId,
            p.nom AS projetNom
        FROM notifications n
        LEFT JOIN projets p ON p.id = n.projet_id
        ORDER BY n.created_at DESC
        """, nativeQuery = true)
    List<NotificationRow> findAllWithProjetNom();

    @Query(value = "SELECT COUNT(*) FROM notifications WHERE is_read = false", nativeQuery = true)
    long countUnread();

    @Query(value = """
        SELECT COUNT(*) > 0
        FROM notifications
        WHERE type = :type
          AND titre = :titre
          AND description = :description
        """, nativeQuery = true)
    boolean existsByTypeTitreDescription(
        @Param("type") String type,
        @Param("titre") String titre,
        @Param("description") String description
    );

    @Query(value = """
        SELECT COUNT(*) > 0
        FROM notifications
        WHERE type = :type
          AND titre = :titre
        """, nativeQuery = true)
    boolean existsByTypeAndTitre(
        @Param("type") String type,
        @Param("titre") String titre
    );

    @Modifying
    @Query(value = """
        UPDATE notifications
        SET is_read = true, updated_at = NOW()
        WHERE id = :id
        RETURNING
            id AS id,
            type AS type,
            titre AS titre,
            description AS description,
            is_read AS isRead,
            created_at AS createdAt,
            updated_at AS updatedAt,
            projet_id AS projetId
        """, nativeQuery = true)
    List<NotificationMutationRow> markAsReadReturning(@Param("id") Long id);

    @Modifying
    @Query(value = "DELETE FROM notifications WHERE id = :id", nativeQuery = true)
    int deleteByIdNative(@Param("id") Long id);

    @Modifying
    @Query(value = "UPDATE notifications SET is_read = true, updated_at = NOW() WHERE is_read = false", nativeQuery = true)
    int markAllRead();

    @Modifying
    @Query(value = "UPDATE notifications SET projet_id = NULL, updated_at = NOW() WHERE projet_id = :projetId", nativeQuery = true)
    int detachProject(@Param("projetId") Long projetId);

    @Modifying
    @Query(value = """
        DELETE FROM notifications n
        WHERE n.titre = 'Projet actif sans manager responsable'
          AND n.projet_id IS NOT NULL
          AND (
                NOT EXISTS (
                    SELECT 1
                    FROM projets p
                    WHERE p.id = n.projet_id
                )
                OR EXISTS (
                    SELECT 1
                    FROM projets p
                    WHERE p.id = n.projet_id
                      AND (
                            p.manager_id IS NOT NULL
                            OR LOWER(COALESCE(p.statut, '')) = 'termine'
                      )
                )
          )
        """, nativeQuery = true)
    int deleteResolvedProjectWithoutManagerNotifications();

    @Query(value = """
        SELECT DISTINCT
            p.id AS id,
            p.nom AS nom,
            p.date_fin AS dateFin,
            p.statut AS statut
        FROM projets p
        WHERE LOWER(COALESCE(p.statut, '')) <> 'termine'
          AND p.manager_id IS NULL
        ORDER BY p.date_fin ASC
        """, nativeQuery = true)
    List<ProjectWithoutManagerRow> findProjectsWithoutManager();

    @Query(value = """
        SELECT
            p.id AS id,
            p.nom AS nom,
            p.date_fin AS dateFin,
            p.statut AS statut
        FROM projets p
        WHERE p.date_fin < NOW()
          AND LOWER(COALESCE(p.statut, '')) <> 'termine'
        ORDER BY p.date_fin ASC
        """, nativeQuery = true)
    List<ProjectLateRow> findProjectsLate();

    @Query(value = """
        SELECT
            p.id AS id,
            p.nom AS nom,
            p.date_fin AS dateFin
        FROM projets p
        WHERE p.date_fin BETWEEN NOW() AND NOW() + INTERVAL '7 days'
          AND LOWER(COALESCE(p.statut, '')) <> 'termine'
        ORDER BY p.date_fin ASC
        """, nativeQuery = true)
    List<ProjectExpiringRow> findProjectsExpiringSoon();

    @Query(value = """
        SELECT
            c.id AS id,
            c.prenom AS prenom,
            c.nom AS nom,
            COUNT(a.id) AS nbProjets
        FROM collaborateurs c
        JOIN affectations a ON a.collaborateur_id = c.id
        JOIN projets p ON p.id = a.projet_id
        WHERE LOWER(COALESCE(p.statut, '')) = 'en_cours'
          AND UPPER(COALESCE(c.role, '')) LIKE '%COLLAB%'
        GROUP BY c.id, c.prenom, c.nom
        HAVING COUNT(a.id) > 1
        ORDER BY COUNT(a.id) DESC
        """, nativeQuery = true)
    List<OverloadedCollaboratorRow> findOverloadedCollaborators();
}
