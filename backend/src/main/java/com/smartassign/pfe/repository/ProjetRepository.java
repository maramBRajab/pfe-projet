package com.smartassign.pfe.repository;

import java.util.List;
import java.time.LocalDate;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import com.smartassign.pfe.entity.Projet;

@Repository
public interface ProjetRepository extends JpaRepository<Projet, Long> {

    List<Projet> findByStatut(String statut);

    long countByStatutIgnoreCase(String statut);

    @Query("SELECT COUNT(p) FROM Projet p WHERE p.managerId = :managerId AND UPPER(TRIM(COALESCE(p.statut, ''))) = UPPER(:statut)")
    long countByManagerIdAndStatutIgnoreCase(@Param("managerId") Long managerId, @Param("statut") String statut);

    @Query("SELECT COUNT(p) FROM Projet p WHERE UPPER(TRIM(COALESCE(p.statut, ''))) = 'EN_COURS' AND p.dateFin IS NOT NULL AND p.dateFin < :today")
    long countOverdueActiveProjects(@Param("today") LocalDate today);

    @Query("SELECT COUNT(p) FROM Projet p WHERE p.managerId = :managerId AND UPPER(TRIM(COALESCE(p.statut, ''))) NOT IN ('TERMINE', 'EN_ATTENTE') AND p.dateFin IS NOT NULL AND p.dateFin < :today")
    long countOverdueActiveProjectsByManager(@Param("managerId") Long managerId, @Param("today") LocalDate today);

    List<Projet> findByNomContainingIgnoreCase(String nom);

    boolean existsByNom(String nom);
}