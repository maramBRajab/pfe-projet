package com.smartassign.pfe.repository;

import com.smartassign.pfe.entity.NotificationLue;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

@Repository
public interface NotificationLueRepository extends JpaRepository<NotificationLue, Long> {

    boolean existsByNotificationKey(String notificationKey);

    @Query("SELECT n.notificationKey FROM NotificationLue n")
    List<String> findAllNotificationKeys();
}
