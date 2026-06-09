package com.smartassign.pfe.controller;

import java.util.List;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.smartassign.pfe.dto.AdminRolesDto.RoleItem;
import com.smartassign.pfe.service.AdminRolesService;

import lombok.RequiredArgsConstructor;

@RestController
@RequestMapping("/api/admin/roles")
@RequiredArgsConstructor
public class AdminRolesController {

    private final AdminRolesService service;

    @GetMapping
    public ResponseEntity<List<RoleItem>> getRoles() {
        return ResponseEntity.ok(service.getRoles());
    }
}
