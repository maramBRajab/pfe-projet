package com.smartassign.pfe.entity;

import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.time.LocalDateTime;

@Entity
@Table(name = "notification_supprimee")
@Data
@NoArgsConstructor
public class NotificationSupprimee {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String notificationKey;
    private LocalDateTime supprimeLe;

    public NotificationSupprimee(String notificationKey) {
        this.notificationKey = notificationKey;
        this.supprimeLe = LocalDateTime.now();
    }
}
