package com.example.controller;

import com.example.dto.BatchCritereRequest;
import com.example.dto.CritereAuditLogDTO;
import com.example.dto.CritereDTO;
import com.example.dto.CritereRequest;
import com.example.service.CritereAuditService;
import com.example.service.CritereImageStorageService;
import com.example.service.CritereService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/criteres")
@RequiredArgsConstructor
@Tag(name = "Critères", description = "Gestion des critères — Accès PPO/ADMIN")
@SecurityRequirement(name = "bearerAuth")
public class CritereController {

    private final CritereService critereService;
    private final CritereAuditService auditService;
    private final CritereImageStorageService imageStorageService;


@PostMapping("/{id}/regenerate-image")
@PreAuthorize("hasAnyRole('PPO','ADMIN','ADMIN_PLANT')")
public ResponseEntity<?> regenerateImage(
        @PathVariable Long id,
        @RequestParam(required = false) String keyword) {
    try {
        // keyword null ou vide → buildPrompt() utilisé automatiquement dans generateAiImage
        String prompt = (keyword != null && !keyword.isBlank()) ? keyword : null;
        String imageUrl = critereService.generateAiImage(id, prompt);
        return ResponseEntity.ok(Map.of("url", imageUrl));
    } catch (RuntimeException e) {
        String error = e.getMessage() != null ? e.getMessage() : "Erreur génération IA.";
        if (error.toLowerCase().contains("credits hugging face epuises")) {
            return ResponseEntity.ok(Map.of("url", "", "warning", error));
        }
        return ResponseEntity.badRequest().body(Map.of("error", error));
    }
}
    @GetMapping
    @Operation(summary = "Liste tous les critères")
    public ResponseEntity<List<CritereDTO>> findAll() {
        return ResponseEntity.ok(critereService.findAll());
    }

    @GetMapping("/processus/{processusId}")
    @Operation(summary = "Critères d'un processus, optionnellement filtrés par variante USS")
    public ResponseEntity<List<CritereDTO>> findByProcessus(
            @PathVariable Long processusId,
            @RequestParam(required = false) String ussVariant) {
        return ResponseEntity.ok(critereService.findByProcessus(processusId, ussVariant));
    }

    @PostMapping
    @PreAuthorize("hasAnyRole('PPO','ADMIN','ADMIN_PLANT')")
    @Operation(summary = "Créer un critère")
    public ResponseEntity<?> create(@RequestBody CritereRequest req, Authentication auth) {
        try {
            return ResponseEntity.ok(critereService.create(req, auth.getName()));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasAnyRole('PPO','ADMIN','ADMIN_PLANT')")
    @Operation(summary = "Modifier un critère")
    public ResponseEntity<?> update(@PathVariable Long id,
            @RequestBody CritereRequest req,
            Authentication auth) {
        try {
            return ResponseEntity.ok(critereService.update(id, req, auth.getName()));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasAnyRole('PPO','ADMIN','ADMIN_PLANT')")
    @Operation(summary = "Supprimer un critère")
    public ResponseEntity<?> delete(@PathVariable Long id, Authentication auth) {
        try {
            return ResponseEntity.ok(critereService.delete(id, auth.getName()));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }

    @PostMapping("/batch-delete")
    @PreAuthorize("hasAnyRole('PPO','ADMIN','ADMIN_PLANT')")
    @Operation(summary = "Supprimer plusieurs critères")
    public ResponseEntity<?> batchDelete(@RequestBody Map<String, List<Long>> body,
            Authentication auth) {
        try {
            List<Long> ids = body.get("ids");
            if (ids == null || ids.isEmpty())
                return ResponseEntity.badRequest().body("Aucun id fourni.");
            return ResponseEntity.ok(critereService.deleteAll(ids, auth.getName()));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }

    @PostMapping("/batch")
    @PreAuthorize("hasAnyRole('ADMIN','ADMIN_PLANT','PPO')")
    @Operation(summary = "Import batch critères")
    public ResponseEntity<?> ajouterBatch(@RequestBody BatchCritereRequest req, Authentication auth) {
        try {
            return ResponseEntity.ok(critereService.ajouterBatch(req, auth.getName()));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }

    @PostMapping("/recompute-images")
    @PreAuthorize("hasAnyRole('ADMIN','ADMIN_PLANT','PPO')")
    @Operation(summary = "Recalculer les images existantes des critères")
    public ResponseEntity<?> recomputeImages(
            @RequestParam(required = false) Long processusId,
            @RequestParam(defaultValue = "false") boolean force,
            @RequestParam(defaultValue = "0") int limit,
            Authentication auth) {
        try {
            return ResponseEntity.ok(critereService.recomputeImages(processusId, force, limit, auth.getName()));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    // ── Endpoints Historique ─────────────────────────────────────

    @PostMapping("/upload-image")
    @PreAuthorize("hasAnyRole('PPO','ADMIN','ADMIN_PLANT')")
    @Operation(summary = "Uploader une image de reference pour un critere")
    public ResponseEntity<Map<String, String>> uploadImage(@RequestParam("file") MultipartFile file) {
        String url = imageStorageService.storeFile(file);
        return ResponseEntity.ok(Map.of("url", url));
    }

    @GetMapping("/{id}/historique")
    @PreAuthorize("hasAnyRole('PPO','ADMIN','ADMIN_PLANT','AGENT_QUALITE')")
    @Operation(summary = "Historique d'un critère")
    public ResponseEntity<List<CritereAuditLogDTO>> getHistoriqueCritere(@PathVariable Long id) {
        return ResponseEntity.ok(auditService.getHistoriqueCritere(id));
    }

    @GetMapping("/audit")
    @PreAuthorize("hasAnyRole('ADMIN','ADMIN_PLANT')")
    @Operation(summary = "Historique global paginé")
    public ResponseEntity<Page<CritereAuditLogDTO>> getHistoriqueGlobal(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        return ResponseEntity.ok(auditService.getHistoriqueGlobal(page, size));
    }

    @GetMapping("/audit/recent")
    @PreAuthorize("hasAnyRole('PPO','ADMIN','ADMIN_PLANT')")
    @Operation(summary = "Dernières 10 actions")
    public ResponseEntity<List<CritereAuditLogDTO>> getDernieresActions() {
        return ResponseEntity.ok(auditService.getDernieresActions());
    }

    

    @PostMapping("/{id}/generate-ai-image")
    @PreAuthorize("hasAnyRole('ADMIN','ADMIN_PLANT','PPO')")
    @Operation(summary = "Generer une image IA (Hugging Face) pour un critere")
    public ResponseEntity<?> generateAiImage(@PathVariable Long id, @RequestParam(required = false) String prompt) {
        try {
            String imageUrl = critereService.generateAiImage(id, prompt);
            return ResponseEntity.ok(Map.of("url", imageUrl));
        } catch (RuntimeException e) {
            String error = e.getMessage() != null ? e.getMessage() : "Erreur lors de la generation IA.";
            String lower = error.toLowerCase();
            if (lower.contains("credits hugging face epuises")) {
                // Cas fonctionnel connu (quota HF), non bloquant pour le workflow.
                return ResponseEntity.ok(Map.of("url", "", "warning", error));
            }
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }
}
