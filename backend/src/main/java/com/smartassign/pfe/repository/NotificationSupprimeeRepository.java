package com.smartassign.pfe.repository;

import com.smartassign.pfe.entity.NotificationSupprimee;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

@Repository
public interface NotificationSupprimeeRepository extends JpaRepository<NotificationSupprimee, Long> {
    boolean existsByNotificationKey(String notificationKey);

    @Query("SELECT n.notificationKey FROM NotificationSupprimee n")
    List<String> findAllNotificationKeys();
}
