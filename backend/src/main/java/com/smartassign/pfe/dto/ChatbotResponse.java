package com.smartassign.pfe.dto;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

import lombok.Data;

@Data
public class ChatbotResponse {
    private String          message;
    private String          type;
    private List<Object>    resultats = new ArrayList<>();
    private LocalDateTime   timestamp = LocalDateTime.now();
}
