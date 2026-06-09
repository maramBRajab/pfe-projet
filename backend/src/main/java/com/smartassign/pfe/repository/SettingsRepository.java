package com.smartassign.pfe.repository;

import com.smartassign.pfe.entity.Settings;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface SettingsRepository extends JpaRepository<Settings, Long> {
    // Le singleton a toujours id = 1 — on utilise findById(1L)
}
