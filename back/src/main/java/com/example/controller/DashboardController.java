package com.example.controller;

import com.example.dto.DashboardStatsDTO;
import com.example.dto.ProcessusCountDTO;
import com.example.dto.ChecklistRecentDTO;
import com.example.dto.OperatorPerformanceDTO;
import com.example.service.DashboardService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.time.LocalDate;

@RestController
@RequestMapping("/api/dashboard")
@CrossOrigin(origins = "*")
public class DashboardController {

    @Autowired
    private DashboardService dashboardService;

    @GetMapping("/stats")
    @PreAuthorize("hasAnyRole('ADMIN','ADMIN_PLANT','PPO','OPERATEUR','CHEF_LIGNE','AGENT_QUALITE','RESPONSABLE_PRODUCTION','TECHNICIEN')")
    public ResponseEntity<DashboardStatsDTO> getStats() {
        return ResponseEntity.ok(dashboardService.getGlobalStats());
    }

    @GetMapping("/processus-counts")
    @PreAuthorize("hasAnyRole('ADMIN','ADMIN_PLANT','PPO','CHEF_LIGNE','AGENT_QUALITE','RESPONSABLE_PRODUCTION','TECHNICIEN')")
    public ResponseEntity<List<ProcessusCountDTO>> getProcessusCounts() {
        return ResponseEntity.ok(dashboardService.getChecklistCountsByProcessus());
    }

    @GetMapping("/recent-checklists")
    @PreAuthorize("hasAnyRole('ADMIN','ADMIN_PLANT','PPO','OPERATEUR','CHEF_LIGNE','AGENT_QUALITE','RESPONSABLE_PRODUCTION','TECHNICIEN')")
    public ResponseEntity<List<ChecklistRecentDTO>> getRecentChecklists(
            @RequestParam(defaultValue = "10") int limit) {
        return ResponseEntity.ok(dashboardService.getRecentChecklists(limit));
    }

    @GetMapping("/stats/period")
    @PreAuthorize("hasAnyRole('ADMIN','ADMIN_PLANT','PPO','AGENT_QUALITE','RESPONSABLE_PRODUCTION')")
    public ResponseEntity<DashboardStatsDTO> getStatsByPeriod(
            @RequestParam String startDate,
            @RequestParam String endDate) {
        return ResponseEntity.ok(dashboardService.getStatsByPeriod(startDate, endDate));
    }

    @GetMapping("/operator-performance")
    @PreAuthorize("hasAnyRole('ADMIN','ADMIN_PLANT','PPO','OPERATEUR','CHEF_LIGNE','AGENT_QUALITE','RESPONSABLE_PRODUCTION','TECHNICIEN')")
    public ResponseEntity<List<OperatorPerformanceDTO>> getOperatorPerformance(
            @RequestParam(required = false) String startDate,
            @RequestParam(required = false) String endDate,
            @RequestParam(defaultValue = "30") int days) {
        LocalDate end = endDate != null ? LocalDate.parse(endDate) : LocalDate.now();
        int safeDays = Math.max(days, 1);
        LocalDate start = startDate != null ? LocalDate.parse(startDate) : end.minusDays(safeDays - 1L);
        return ResponseEntity.ok(dashboardService.getOperatorPerformance(start, end));
    }

    @GetMapping("/stats/site-plant")
    @PreAuthorize("hasAnyRole('ADMIN','ADMIN_PLANT','PPO','CHEF_LIGNE','AGENT_QUALITE','RESPONSABLE_PRODUCTION')")
    public ResponseEntity<List<com.example.dto.SitePlantStatsDTO>> getStatsBySiteAndPlant() {
        return ResponseEntity.ok(dashboardService.getStatsBySiteAndPlant());
    }
}