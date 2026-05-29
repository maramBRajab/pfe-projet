package com.smartassign.pfe.dto;

import lombok.*;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class CompetenceResponse {
    private Long   id;
    private String nom;
}