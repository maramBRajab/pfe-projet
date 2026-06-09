package com.smartassign.pfe.entity;

import java.time.LocalDateTime;

import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.Data;
import lombok.NoArgsConstructor;

@Entity
@Table(name = "notification_lue")
@Data
@NoArgsConstructor
public class NotificationLue {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String notificationKey;
    private LocalDateTime luLe;

    public NotificationLue(String notificationKey) {
        this.notificationKey = notificationKey;
        this.luLe = LocalDateTime.now();
    }
}
