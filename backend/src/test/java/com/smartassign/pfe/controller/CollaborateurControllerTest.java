package com.smartassign.pfe.controller;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.Set;

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
import com.smartassign.pfe.dto.CollaborateurRequest;
import com.smartassign.pfe.dto.CollaborateurResponse;
import com.smartassign.pfe.dto.CompetenceResponse;
import com.smartassign.pfe.exception.GlobalExceptionHandler;
import com.smartassign.pfe.service.CollaborateurService;

@WebMvcTest(CollaborateurController.class)
@AutoConfigureMockMvc(addFilters = false)
@Import({ SecurityConfig.class, GlobalExceptionHandler.class })
class CollaborateurControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @MockBean
    private CollaborateurService collaborateurService;

    @Test
    void shouldReturnBadRequestWhenCollaborateurPayloadIsInvalid() throws Exception {
        CollaborateurRequest payload = new CollaborateurRequest();

        mockMvc.perform(post("/api/collaborateurs")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(payload)))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.message").value("Les donnees envoyees sont invalides"))
            .andExpect(jsonPath("$.validationErrors.nom").exists())
            .andExpect(jsonPath("$.validationErrors.prenom").exists());
    }

    @Test
    void shouldCreateCollaborateurWhenPayloadIsValid() throws Exception {
        CompetenceResponse competence = CompetenceResponse.builder()
            .id(1L)
            .nom("Java")
            .build();

        CollaborateurRequest payload = new CollaborateurRequest();
        payload.setNom("Ben Ali");
        payload.setPrenom("Sami");
        payload.setRole("MANAGER");
        payload.setExperienceAnnees(4);
        payload.setDisponible(true);
        payload.setCompetenceIds(Set.of(1L));

        CollaborateurResponse saved = CollaborateurResponse.builder()
            .id(10L)
            .nom(payload.getNom())
            .prenom(payload.getPrenom())
            .email("sami.ben.ali@smartassign.tn")
            .role(payload.getRole())
            .motDePasseGenere("A7b#Smart42!")
            .experienceAnnees(payload.getExperienceAnnees())
            .disponible(payload.isDisponible())
            .competences(Set.of(competence))
            .build();

        when(collaborateurService.create(any(CollaborateurRequest.class))).thenReturn(saved);

        mockMvc.perform(post("/api/collaborateurs")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(payload)))
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.id").value(10))
            .andExpect(jsonPath("$.email").value("sami.ben.ali@smartassign.tn"))
            .andExpect(jsonPath("$.role").value("MANAGER"))
            .andExpect(jsonPath("$.motDePasseGenere").value("A7b#Smart42!"))
            .andExpect(jsonPath("$.competences[0].nom").value("Java"));
    }
}