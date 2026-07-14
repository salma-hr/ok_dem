package com.example.controller;

import com.example.dto.ChecklistAuditLogDTO;
import com.example.dto.ChecklistDTO;
import com.example.dto.ChecklistRequest;
import com.example.service.ChecklistService;
import com.example.service.ChecklistAuditService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import java.util.List;
import java.util.Map;
import com.example.repository.ReponseCritereRepository;
import com.example.repository.PlanActionRepository;
import com.example.repository.OkDemarrageRepository;

@RestController
@RequestMapping("/api/checklists")
@RequiredArgsConstructor
@Tag(name = "Checklist OK Démarrage")
@SecurityRequirement(name = "bearerAuth")
public class ChecklistController {

    private final ChecklistService checklistService;
    private final ChecklistAuditService checklistAuditService;
    private final ReponseCritereRepository reponseCritereRepository;
    private final PlanActionRepository planActionRepository;
    private final OkDemarrageRepository okDemarrageRepository;

    @GetMapping
    @Operation(summary = "Liste toutes les checklists")
    public ResponseEntity<List<ChecklistDTO>> findAll() {
        return ResponseEntity.ok(checklistService.findAll());
    }

    @GetMapping("/{id}")
    @Operation(summary = "Détail d'une checklist")
    public ResponseEntity<ChecklistDTO> findById(@PathVariable Long id) {
        return ResponseEntity.ok(checklistService.findById(id));
    }

    @GetMapping("/{id}/audit")
    @Operation(summary = "Journal d'audit d'une checklist")
    public ResponseEntity<List<ChecklistAuditLogDTO>> getAuditChecklist(@PathVariable Long id) {
        return ResponseEntity.ok(checklistAuditService.getHistoriqueChecklist(id));
    }

    @GetMapping("/{id}/export-pdf")
    @Operation(summary = "Exporter le dossier checklist en PDF")
    public ResponseEntity<ByteArrayResource> exportChecklistPdf(@PathVariable Long id) {
        byte[] data = checklistService.exportChecklistPdf(id);
        ByteArrayResource resource = new ByteArrayResource(data);
        return ResponseEntity.status(HttpStatus.OK)
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=checklist_" + id + ".pdf")
                .contentType(MediaType.APPLICATION_PDF)
                .contentLength(data.length)
                .body(resource);
    }

    // ════════════════════════════════════════════════════════════════
    // BROUILLON — 3 endpoints
    // ════════════════════════════════════════════════════════════════

    /**
     * Vérifier l'état avant de commencer :
     * → NOUVEAU / BROUILLON (reprendre) / DEJA_SOUMIS (bloquer)
     *
     * GET /api/checklists/etat?operateurId=1&machineId=2&session=M&date=2026-04-01
     */
    @GetMapping("/etat")
    @PreAuthorize("hasAnyRole('OPERATEUR','CHEF_LIGNE','ADMIN','ADMIN_PLANT')")
    @Operation(summary = "Vérifier si une checklist existe déjà (brouillon ou soumise)")
    public ResponseEntity<Map<String, Object>> verifierEtat(
            @RequestParam Long operateurId,
            @RequestParam(required = false) Long machineId,
            @RequestParam String session,
            @RequestParam String date) {
        try {
            return ResponseEntity.ok(checklistService.verifierEtat(operateurId, machineId, session, date));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(Map.of("erreur", e.getMessage()));
        }
    }

    /**
     * Sauvegarder un brouillon (réponses partielles, statut EN_COURS).
     * Peut être appelé autant de fois que nécessaire.
     *
     * POST /api/checklists/brouillon
     */
    @PostMapping("/brouillon")
    @PreAuthorize("hasAnyRole('OPERATEUR','CHEF_LIGNE','ADMIN','ADMIN_PLANT')")
    @Operation(summary = "Sauvegarder un brouillon (peut être incomplet)")
    public ResponseEntity<?> sauvegarderBrouillon(@RequestBody ChecklistRequest req) {
        try {
            return ResponseEntity.ok(checklistService.sauvegarderBrouillon(req));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }

    /**
     * Récupérer les brouillons d'un opérateur (EN_COURS uniquement).
     *
     * GET /api/checklists/brouillons/operateur/1
     */
    @GetMapping("/brouillons/operateur/{operateurId}")
    @PreAuthorize("hasAnyRole('OPERATEUR','CHEF_LIGNE','ADMIN','ADMIN_PLANT')")
    @Operation(summary = "Brouillons en cours d'un opérateur")
    public ResponseEntity<List<ChecklistDTO>> getBrouillonsOperateur(
            @PathVariable Long operateurId,
            @RequestParam(required = false) String date) {
        return ResponseEntity.ok(checklistService.getBrouillonsOperateur(operateurId, date));
    }

    // ════════════════════════════════════════════════════════════════
    // SOUMISSION FINALE
    // ════════════════════════════════════════════════════════════════

    @PostMapping("/soumettre")
    @PreAuthorize("hasAnyRole('OPERATEUR','ADMIN','ADMIN_PLANT')")
    @Operation(summary = "Soumettre une checklist complète (Opérateur)")
    public ResponseEntity<?> soumettre(@RequestBody ChecklistRequest req) {
        try {
            int duree = req.getDureeFillSec() != null ? Math.max(1, req.getDureeFillSec()) : 1;
            return ResponseEntity.ok(checklistService.soumettre(req, duree));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }

    @DeleteMapping("/delete-all")
    @PreAuthorize("hasAnyRole('ADMIN','ADMIN_PLANT')")
    public ResponseEntity<?> deleteAll() {

        reponseCritereRepository.deleteAll();
        planActionRepository.deleteAll();
        okDemarrageRepository.deleteAll();

        return ResponseEntity.ok().build();
    }
    // ════════════════════════════════════════════════════════════════
    // WORKFLOW VALIDATION
    // ════════════════════════════════════════════════════════════════

    @PatchMapping("/{id}/valider-n1")
    @PreAuthorize("hasAnyRole('CHEF_LIGNE','ADMIN','ADMIN_PLANT')")
    public ResponseEntity<?> validerN1(@PathVariable Long id, Authentication auth) {
        try {
            return ResponseEntity.ok(checklistService.validerN1(id, auth.getName()));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }

    @PatchMapping("/{id}/valider-n2")
    @PreAuthorize("hasAnyRole('TECHNICIEN','ADMIN','ADMIN_PLANT')")
    public ResponseEntity<?> validerN2(@PathVariable Long id, Authentication auth) {
        try {
            return ResponseEntity.ok(checklistService.validerN2(id, auth.getName()));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }

    @PatchMapping("/{id}/valider-final")
    @PreAuthorize("hasAnyRole('AGENT_QUALITE','ADMIN','ADMIN_PLANT')")
    public ResponseEntity<?> validerFinal(@PathVariable Long id, Authentication auth) {
        try {
            return ResponseEntity.ok(checklistService.validerFinal(id, auth.getName()));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }

    @PatchMapping("/{id}/rejeter")
    @PreAuthorize("hasAnyRole('CHEF_LIGNE','TECHNICIEN','AGENT_QUALITE','ADMIN','ADMIN_PLANT')")
    @Operation(summary = "Rejeter une checklist (motif obligatoire)")
    public ResponseEntity<?> rejeter(
            @PathVariable Long id,
            @RequestParam String motif,
            Authentication auth) {
        try {
            return ResponseEntity.ok(checklistService.rejeter(id, motif, auth.getName()));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasAnyRole('ADMIN','ADMIN_PLANT')")
    @Operation(summary = "Supprimer une checklist (Admin uniquement)")
    public ResponseEntity<?> delete(@PathVariable Long id) {
        try {
            checklistService.delete(id);
            return ResponseEntity.noContent().build();
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }

    @PostMapping(value = "/import-pdf", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @PreAuthorize("hasAnyRole('ADMIN','ADMIN_PLANT','PPO')")
    @Operation(summary = "Importer un PDF et générer automatiquement les critères")
    public ResponseEntity<?> importerChecklistPdf(
            @RequestParam("file") MultipartFile file,
            @RequestParam("processusId") Long processusId) {
        if (file.isEmpty())
            return ResponseEntity.badRequest().body(Map.of("erreur", "Fichier PDF manquant.", "total", 0));
        String ct = file.getContentType();
        if (ct == null || !ct.equalsIgnoreCase("application/pdf"))
            return ResponseEntity.badRequest().body(Map.of("erreur", "Le fichier doit être un PDF.", "total", 0));
        try {
            return ResponseEntity.ok(checklistService.importerCriteresDepuisPdf(file, processusId));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("erreur", e.getMessage(), "total", 0));
        }
    }
}
