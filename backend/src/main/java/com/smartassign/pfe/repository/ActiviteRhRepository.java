package com.smartassign.pfe.repository;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import com.smartassign.pfe.entity.ActiviteRh;

@Repository
public interface ActiviteRhRepository extends JpaRepository<ActiviteRh, Long> {

    List<ActiviteRh> findByUserIdOrderByDateDesc(Long userId);

    List<ActiviteRh> findAllByOrderByDateDesc();
}