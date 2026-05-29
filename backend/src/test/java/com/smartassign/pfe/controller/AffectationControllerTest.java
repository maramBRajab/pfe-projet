package com.smartassign.pfe.controller;

import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Set;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Import;
import org.springframework.test.web.servlet.MockMvc;

import com.smartassign.pfe.config.SecurityConfig;
import com.smartassign.pfe.dto.AffectationResponse;
import com.smartassign.pfe.dto.CollaborateurResponse;
import com.smartassign.pfe.dto.CompetenceResponse;
import com.smartassign.pfe.dto.ProjetResponse;
import com.smartassign.pfe.exception.BusinessException;
import com.smartassign.pfe.exception.GlobalExceptionHandler;
import com.smartassign.pfe.service.AffectationService;

@WebMvcTest(AffectationController.class)
@AutoConfigureMockMvc(addFilters = false)
@Import({ SecurityConfig.class, GlobalExceptionHandler.class })
class AffectationControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private AffectationService affectationService;

    @Test
    void shouldReturnBusinessErrorWhenNoCompatibleCollaborateurExists() throws Exception {
        when(affectationService.lancerAffectation(4L))
            .thenThrow(new BusinessException("Aucun collaborateur compatible n'a ete trouve pour ce projet"));

        mockMvc.perform(post("/api/affectations/lancer/4"))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.message").value("Aucun collaborateur compatible n'a ete trouve pour ce projet"));
    }

    @Test
    void shouldReturnSortedAffectationResults() throws Exception {
        CompetenceResponse java = CompetenceResponse.builder().id(1L).nom("Java").build();

        ProjetResponse projet = ProjetResponse.builder()
            .id(7L)
            .nom("Projet RH")
            .description("Projet d'affectation")
            .dateDebut(LocalDate.of(2026, 3, 1))
            .dateFin(LocalDate.of(2026, 6, 30))
            .statut("en_cours")
            .competencesRequises(Set.of(java))
            .build();

        List<AffectationResponse> results = List.of(
            AffectationResponse.builder()
                .id(11L)
                .projet(projet)
                .collaborateur(CollaborateurResponse.builder()
                    .id(1L)
                    .nom("Sami")
                    .prenom("Ben Ali")
                    .email("sami@example.com")
                    .experienceAnnees(5)
                    .disponible(true)
                    .competences(Set.of(java))
                    .build())
                .score(89.5)
                .dateAffectation(LocalDateTime.of(2026, 3, 27, 10, 0))
                .build(),
            AffectationResponse.builder()
                .id(12L)
                .projet(projet)
                .collaborateur(CollaborateurResponse.builder()
                    .id(2L)
                    .nom("Lina")
                    .prenom("Trabelsi")
                    .email("lina@example.com")
                    .experienceAnnees(3)
                    .disponible(true)
                    .competences(Set.of(java))
                    .build())
                .score(72.0)
                .dateAffectation(LocalDateTime.of(2026, 3, 27, 10, 1))
                .build()
        );

        when(affectationService.lancerAffectation(7L)).thenReturn(results);

        mockMvc.perform(post("/api/affectations/lancer/7"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$[0].collaborateur.nom").value("Sami"))
            .andExpect(jsonPath("$[0].collaborateur.prenom").value("Ben Ali"))
            .andExpect(jsonPath("$[0].score").value(89.5))
            .andExpect(jsonPath("$[1].collaborateur.experienceAnnees").value(3));
    }
}