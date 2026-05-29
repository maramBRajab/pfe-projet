package com.smartassign.pfe.controller;

import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.LocalDate;

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
import com.smartassign.pfe.entity.Projet;
import com.smartassign.pfe.exception.GlobalExceptionHandler;
import com.smartassign.pfe.exception.ResourceNotFoundException;
import com.smartassign.pfe.service.ProjetService;

@WebMvcTest(ProjetController.class)
@AutoConfigureMockMvc(addFilters = false)
@Import({ SecurityConfig.class, GlobalExceptionHandler.class })
class ProjetControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @MockBean
    private ProjetService projetService;

    @Test
    void shouldReturnNotFoundWhenProjetDoesNotExist() throws Exception {
        when(projetService.getById(999L)).thenThrow(new ResourceNotFoundException("Projet non trouve"));

        mockMvc.perform(get("/api/projets/999"))
            .andExpect(status().isNotFound())
            .andExpect(jsonPath("$.message").value("Projet non trouve"))
            .andExpect(jsonPath("$.path").value("/api/projets/999"));
    }

    @Test
    void shouldRejectProjetWhenDatesAreInvalid() throws Exception {
        Projet payload = new Projet();
        payload.setNom("Migration RH");
        payload.setDescription("Projet de migration");
        payload.setDateDebut(LocalDate.of(2026, 5, 10));
        payload.setDateFin(LocalDate.of(2026, 5, 1));
        payload.setStatut("en_cours");

        mockMvc.perform(post("/api/projets")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(payload)))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.message").value("Les donnees envoyees sont invalides"))
            .andExpect(jsonPath("$.validationErrors.dateRangeValid").value("La date de fin doit etre apres ou egale a la date de debut"));
    }
}