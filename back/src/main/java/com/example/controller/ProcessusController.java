package com.example.controller;

import com.example.dto.ProcessusDTO;
import com.example.dto.ProcessusRequest;
import com.example.service.ProcessusService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import java.util.List;

@RestController
@RequestMapping("/api/processus")
@RequiredArgsConstructor
@Tag(name = "Processus", description = "Gestion des processus — Accès PPO/ADMIN")
@SecurityRequirement(name = "bearerAuth")
public class ProcessusController {

    private final ProcessusService processusService;

    @GetMapping
    @Operation(summary = "Liste tous les processus")
    public ResponseEntity<List<ProcessusDTO>> findAll() {
        return ResponseEntity.ok(processusService.findAll());
    }

    @GetMapping("/{id}")
    @Operation(summary = "Récupérer un processus par ID")
    public ResponseEntity<ProcessusDTO> findById(@PathVariable Long id) {
        return ResponseEntity.ok(processusService.findById(id));
    }

    // GET /api/processus/segment/{segmentId} ← nouveau
    @GetMapping("/segment/{segmentId}")
    @Operation(summary = "Lister les processus d'un segment")
    public ResponseEntity<List<ProcessusDTO>> findBySegment(@PathVariable Long segmentId) {
        return ResponseEntity.ok(processusService.findBySegment(segmentId));
    }

    @PostMapping
    @PreAuthorize("hasAnyRole('PPO','ADMIN','ADMIN_PLANT')")
    @Operation(summary = "Créer un processus")
    public ResponseEntity<?> create(@RequestBody ProcessusRequest req) {
        try {
            return ResponseEntity.ok(processusService.create(req));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasAnyRole('PPO','ADMIN','ADMIN_PLANT')")
    @Operation(summary = "Modifier un processus")
    public ResponseEntity<?> update(@PathVariable Long id, @RequestBody ProcessusRequest req) {
        try {
            return ResponseEntity.ok(processusService.update(id, req));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasAnyRole('PPO','ADMIN','ADMIN_PLANT')")
    @Operation(summary = "Supprimer un processus")
    public ResponseEntity<?> delete(@PathVariable Long id) {
        try {
            return ResponseEntity.ok(processusService.delete(id));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }
}