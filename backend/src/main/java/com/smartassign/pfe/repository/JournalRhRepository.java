package com.smartassign.pfe.repository;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import com.smartassign.pfe.entity.JournalRh;

@Repository
public interface JournalRhRepository extends JpaRepository<JournalRh, Long> {

    List<JournalRh> findAllByOrderByDateDesc();

    @Query(value = """
        SELECT *
        FROM journal_rh j
        WHERE LOWER(COALESCE(j.utilisateur, '')) = LOWER(:email)
        ORDER BY j.date DESC
        LIMIT 5
        """, nativeQuery = true)
    List<JournalRh> findTop5ByUtilisateurEmail(@Param("email") String email);

    @Query(value = """
        SELECT *
        FROM journal_rh j
        WHERE LOWER(COALESCE(j.utilisateur, '')) = LOWER(:email)
        ORDER BY j.date DESC
        LIMIT 10
        """, nativeQuery = true)
    List<JournalRh> findTop10ByUtilisateurEmail(@Param("email") String email);
}