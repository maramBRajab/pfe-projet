package com.smartassign.pfe.controller;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.List;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.smartassign.pfe.config.SecurityConfig;
import com.smartassign.pfe.dto.CompetenceResponse;
import com.smartassign.pfe.exception.GlobalExceptionHandler;
import com.smartassign.pfe.service.CompetenceService;

@WebMvcTest(CompetenceController.class)
@AutoConfigureMockMvc(addFilters = false)
@Import({ SecurityConfig.class, GlobalExceptionHandler.class })
class CompetenceControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private CompetenceService competenceService;

    @Test
    void shouldReturnOrderedCompetences() throws Exception {
        CompetenceResponse angular = CompetenceResponse.builder().id(1L).nom("Angular").build();
        CompetenceResponse java = CompetenceResponse.builder().id(2L).nom("Java").build();

        when(competenceService.getAll()).thenReturn(List.of(angular, java));

        mockMvc.perform(get("/api/competences"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$[0].nom").value("Angular"))
            .andExpect(jsonPath("$[1].nom").value("Java"));
    }

    @Test
    void shouldRejectInvalidCompetencePayload() throws Exception {
        mockMvc.perform(post("/api/competences")
                .contentType(MediaType.APPLICATION_JSON))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.message").exists());
    }

    @Test
    void shouldReturnBusinessErrorWhenCompetenceNameAlreadyExists() throws Exception {
        CompetenceResponse payload = CompetenceResponse.builder().id(1L).nom("Java").build();

        when(competenceService.create(any(String.class)))
            .thenThrow(new RuntimeException("Compétence déjà existante : Java"));

        mockMvc.perform(post("/api/competences")
                .queryParam("nom", payload.getNom())
                .contentType(MediaType.APPLICATION_JSON))
            .andExpect(status().isInternalServerError())
            .andExpect(jsonPath("$.message").value("Une erreur interne est survenue"));
    }
}