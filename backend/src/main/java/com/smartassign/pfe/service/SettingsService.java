package com.smartassign.pfe.service;

import com.smartassign.pfe.dto.SettingsDto;
import com.smartassign.pfe.dto.SettingsResponseDto;
import com.smartassign.pfe.entity.Settings;
import com.smartassign.pfe.repository.SettingsRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;

@Service
@RequiredArgsConstructor
public class SettingsService {

    private final SettingsRepository settingsRepository;

    // ── Valeurs par défaut ────────────────────────────────────
    private static final int    DEFAULT_SEUIL              = 76;
    private static final int    DEFAULT_MAX_PROFILS        = 5;
    private static final boolean DEFAULT_MATCHING_AUTO     = true;
    private static final String  DEFAULT_NOM_PLATEFORME    = "SmartAssign";
    private static final boolean DEFAULT_MODE_MAINTENANCE  = false;

    /**
     * Récupère le singleton Settings (id=1).
     * S'il n'existe pas encore, le crée avec les valeurs par défaut.
     */
    @Transactional
    public Settings getOrCreate() {
        return settingsRepository.findById(1L).orElseGet(() -> {
            Settings defaults = Settings.builder()
                    .seuilCompatibilite(DEFAULT_SEUIL)
                    .maxProfilsRecommandes(DEFAULT_MAX_PROFILS)
                    .matchingAutomatique(DEFAULT_MATCHING_AUTO)
                    .nomPlateforme(DEFAULT_NOM_PLATEFORME)
                    .modeMaintenance(DEFAULT_MODE_MAINTENANCE)
                    .derniereModification(LocalDateTime.now())
                    .modifiePar("system")
                    .build();
            return settingsRepository.save(defaults);
        });
    }

    /** GET /api/admin/settings */
    @Transactional
    public SettingsDto getSettings() {
        return toDto(getOrCreate());
    }

    /** PUT /api/admin/settings */
    @Transactional
    public SettingsResponseDto updateSettings(SettingsDto request, String adminEmail) {
        Settings settings = getOrCreate();

        settings.setSeuilCompatibilite(request.getAffectations().getSeuilCompatibilite());
        settings.setMaxProfilsRecommandes(request.getAffectations().getMaxProfilsRecommandes());
        settings.setMatchingAutomatique(request.getAffectations().getMatchingAutomatique());
        settings.setNomPlateforme(request.getPlateforme().getNomPlateforme());
        settings.setModeMaintenance(request.getPlateforme().getModeMaintenance());
        settings.setDerniereModification(LocalDateTime.now());
        settings.setModifiePar(adminEmail);

        Settings saved = settingsRepository.save(settings);

        return SettingsResponseDto.builder()
                .message("Paramètres sauvegardés avec succès")
                .updatedAt(saved.getDerniereModification())
                .settings(toDto(saved))
                .build();
    }

    /** POST /api/admin/settings/reset */
    @Transactional
    public SettingsResponseDto resetSettings(String adminEmail) {
        Settings settings = getOrCreate();

        settings.setSeuilCompatibilite(DEFAULT_SEUIL);
        settings.setMaxProfilsRecommandes(DEFAULT_MAX_PROFILS);
        settings.setMatchingAutomatique(DEFAULT_MATCHING_AUTO);
        settings.setNomPlateforme(DEFAULT_NOM_PLATEFORME);
        settings.setModeMaintenance(DEFAULT_MODE_MAINTENANCE);
        settings.setDerniereModification(LocalDateTime.now());
        settings.setModifiePar(adminEmail);

        Settings saved = settingsRepository.save(settings);

        return SettingsResponseDto.builder()
                .message("Paramètres réinitialisés")
                .updatedAt(saved.getDerniereModification())
                .settings(toDto(saved))
                .build();
    }

    // ── Mapper ────────────────────────────────────────────────
    public SettingsDto toDto(Settings s) {
        return SettingsDto.builder()
                .affectations(SettingsDto.AffectationsDto.builder()
                        .seuilCompatibilite(s.getSeuilCompatibilite())
                        .maxProfilsRecommandes(s.getMaxProfilsRecommandes())
                        .matchingAutomatique(s.getMatchingAutomatique())
                        .build())
                .plateforme(SettingsDto.PlateformeDto.builder()
                        .nomPlateforme(s.getNomPlateforme())
                        .modeMaintenance(s.getModeMaintenance())
                        .build())
                .meta(SettingsDto.MetaDto.builder()
                        .derniereModification(s.getDerniereModification())
                        .modifiePar(s.getModifiePar())
                        .build())
                .build();
    }
}
