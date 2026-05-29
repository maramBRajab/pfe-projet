package com.smartassign.pfe.model;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.time.LocalDateTime;

@Data
@AllArgsConstructor
@NoArgsConstructor
public class Notification {
    private String type;
    private String titre;
    private String message;
    private String niveau;
    private LocalDateTime dateCreation;

    public static Notification creer(String type, String titre, String message, String niveau) {
        return new Notification(type, titre, message, niveau, LocalDateTime.now());
    }
}