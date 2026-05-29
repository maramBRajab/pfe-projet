package com.smartassign.pfe.controller;

import java.util.List;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.smartassign.pfe.dto.ChatbotMessageRequest;
import com.smartassign.pfe.dto.ChatbotResponse;
import com.smartassign.pfe.service.ChatbotService;

import lombok.RequiredArgsConstructor;

@RestController
@RequestMapping("/api/chatbot")
@RequiredArgsConstructor
public class ChatbotController {

    private final ChatbotService chatbotService;

    @PostMapping("/message")
    public ResponseEntity<ChatbotResponse> envoyerMessage(@RequestBody ChatbotMessageRequest request) {
        ChatbotResponse response = chatbotService.repondre(request.getMessage(), request.getManagerId());
        return ResponseEntity.ok(response);
    }

    @GetMapping("/suggestions")
    public ResponseEntity<List<String>> getSuggestions() {
        return ResponseEntity.ok(chatbotService.getSuggestions());
    }
}
