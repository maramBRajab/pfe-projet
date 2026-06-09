package com.smartassign.pfe.repository;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import com.smartassign.pfe.entity.Jalon;

@Repository
public interface JalonRepository extends JpaRepository<Jalon, Long> {

    List<Jalon> findByUserIdOrderByDateAsc(Long userId);

    List<Jalon> findAllByOrderByDateAsc();

        @Query(value = """
                SELECT *
                FROM jalons j
                WHERE j.user_id = :userId
                    AND j.date >= NOW()
                ORDER BY j.date ASC
                LIMIT 5
                """, nativeQuery = true)
        List<Jalon> getUpcomingJalonsForUser(@Param("userId") Long userId);

        @Query(value = """
            SELECT *
            FROM jalons j
            WHERE j.user_id = :userId
              AND j.date < (CURRENT_TIMESTAMP + INTERVAL '7 day')
              AND LOWER(COALESCE(j.statut, '')) <> 'termine'
            ORDER BY j.date ASC
            """, nativeQuery = true)
        List<Jalon> findVigilanceJalons(@Param("userId") Long userId);
}