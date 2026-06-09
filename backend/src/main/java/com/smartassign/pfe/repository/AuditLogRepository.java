package com.smartassign.pfe.repository;

import com.smartassign.pfe.model.AuditLog;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface AuditLogRepository extends JpaRepository<AuditLog, Long> {
    List<AuditLog> findAllByOrderByDateDesc();
    List<AuditLog> findByStatusOrderByDateDesc(String status);
    List<AuditLog> findByActionOrderByDateDesc(String action);

    @Query(value = """
        SELECT *
        FROM audit_log log
        WHERE LOWER(TRIM(COALESCE(log.utilisateur, ''))) = LOWER(TRIM(:email))
        ORDER BY log.date DESC
        LIMIT 10
        """, nativeQuery = true)
    List<AuditLog> findRecentForUserOrTarget(@Param("email") String email);
}
