package com.smartassign.pfe.repository;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import com.smartassign.pfe.entity.DisponibiliteUtilisateur;
import com.smartassign.pfe.repository.projection.DisponibiliteNotificationProjection;

@Repository
public interface DisponibiliteUtilisateurRepository extends JpaRepository<DisponibiliteUtilisateur, Long> {

    List<DisponibiliteUtilisateur> findAllByOrderByUserIdAsc();

    java.util.Optional<DisponibiliteUtilisateur> findByUserId(Long userId);

    @Query(value = """
        SELECT d.user_id AS id,
               CURRENT_TIMESTAMP AS dateDebut,
               d.statut AS type,
               CONCAT('Disponibilite: ', d.statut) AS libelle
        FROM disponibilites_utilisateurs d
        WHERE d.user_id = :collaborateurId
        """, nativeQuery = true)
    List<DisponibiliteNotificationProjection> findFutureDisponibilites(@Param("collaborateurId") Long collaborateurId);
}