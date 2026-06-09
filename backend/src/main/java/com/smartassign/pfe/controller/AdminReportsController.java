package com.smartassign.pfe.controller;

import com.smartassign.pfe.dto.SystemReportDto;
import com.smartassign.pfe.service.AdminReportsService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/admin/reports")
@RequiredArgsConstructor
public class AdminReportsController {

    private final AdminReportsService adminReportsService;

    @GetMapping("/system")
    public ResponseEntity<SystemReportDto> getSystemReport() {
        return ResponseEntity.ok(adminReportsService.getSystemReport());
    }
}
