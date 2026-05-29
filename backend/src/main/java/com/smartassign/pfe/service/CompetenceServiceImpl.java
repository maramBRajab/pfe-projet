package com.smartassign.pfe.service;

import java.util.List;
import java.util.stream.Collectors;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.smartassign.pfe.dto.CompetenceResponse;
import com.smartassign.pfe.entity.Competence;
import com.smartassign.pfe.exception.BusinessException;
import com.smartassign.pfe.exception.ResourceNotFoundException;
import com.smartassign.pfe.repository.CompetenceRepository;

import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
@Transactional
public class CompetenceServiceImpl implements CompetenceService {

    private final CompetenceRepository competenceRepository;

    @Transactional(readOnly = true)
    public List<CompetenceResponse> getAll() {
        return competenceRepository.findAll()
                .stream()
                .map(c -> new CompetenceResponse(c.getId(), c.getNom()))
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public CompetenceResponse getById(Long id) {
        Competence competence = competenceRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Compétence introuvable : " + id));

        return new CompetenceResponse(competence.getId(), competence.getNom());
    }

    public CompetenceResponse create(String nom) {
        if (competenceRepository.existsByNomIgnoreCase(nom)) {
            throw new BusinessException("Compétence déjà existante : " + nom);
        }
        Competence c = Competence.builder().nom(nom).build();
        c = competenceRepository.save(c);
        return new CompetenceResponse(c.getId(), c.getNom());
    }

    public void delete(Long id) {
        if (!competenceRepository.existsById(id)) {
            throw new ResourceNotFoundException("Compétence introuvable : " + id);
        }
        competenceRepository.deleteById(id);
    }
}