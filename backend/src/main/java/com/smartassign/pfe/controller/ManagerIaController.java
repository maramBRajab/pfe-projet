package com.smartassign.pfe.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.smartassign.pfe.dto.ManagerIaAnalyseRequest;
import com.smartassign.pfe.dto.ManagerIaAnalyseResponse;
import com.smartassign.pfe.service.ManagerIaService;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;

@RestController
@Validated
@RequestMapping("/api/manager/ia")
@RequiredArgsConstructor
public class ManagerIaController {

    private final ManagerIaService managerIaService;

    @PostMapping("/analyse")
    public ResponseEntity<ManagerIaAnalyseResponse> analyser(@Valid @RequestBody ManagerIaAnalyseRequest request) {
        String reponse = managerIaService.analyserQuestion(request.getQuestion());
        return ResponseEntity.ok(new ManagerIaAnalyseResponse(reponse));
    }
}
