package com.smartassign.pfe.repository;

import com.smartassign.pfe.entity.NotificationSupprimee;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface NotificationSupprimeeRepository extends JpaRepository<NotificationSupprimee, Long> {
    boolean existsByNotificationKey(String notificationKey);
}
