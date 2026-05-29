package com.smartassign.pfe.dto;

import lombok.Data;

@Data
public class ChatbotMessageRequest {
    private String message;
    private Long   managerId;
}
