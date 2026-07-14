package com.example.controller;

import com.example.service.PdfImportService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.Map;

@RestController
@RequestMapping("/api/criteres/import-pdf")
@RequiredArgsConstructor
@Tag(name = "Import PDF", description = "Import de critères depuis checklist PDF")
@SecurityRequirement(name = "bearerAuth")
public class PdfImportController {

    private final PdfImportService pdfImportService;

    /**
     * Extrait les critères d'un PDF sans les sauvegarder (prévisualisation).
     * POST /api/criteres/import-pdf/preview?processusId=1
     */
    @PostMapping("/preview")
    @PreAuthorize("hasAnyRole('ADMIN','ADMIN_PLANT','PPO')")
    @Operation(summary = "Prévisualiser les critères extraits d'un PDF")
    public ResponseEntity<?> preview(
            @RequestParam("file") MultipartFile file,
            @RequestParam("processusId") Long processusId) {
        try {
            if (file.isEmpty()) {
                return ResponseEntity.badRequest().body(Map.of("error", "Fichier vide"));
            }
            if (!file.getOriginalFilename().toLowerCase().endsWith(".pdf")) {
                return ResponseEntity.badRequest().body(Map.of("error", "Fichier PDF requis"));
            }

            // Appel Python uniquement — pas de sauvegarde
            var extraction = pdfImportService.previewFromPdf(file);
            int nbCriteres = extraction.path("nbCriteres").asInt(0);

            return ResponseEntity.ok(Map.of(
                    "processusNom", extraction.path("processusNom").asText("Inconnu"),
                    "nbCriteres", nbCriteres,
                    "total", nbCriteres,
                    "processusId", processusId,
                    "criteres", extraction.path("criteres"),
                    "warnings", extraction.path("warnings")));
        } catch (Exception e) {
            return ResponseEntity.internalServerError()
                    .body(Map.of("error", e.getMessage()));
        }
    }

    /**
     * Importe et sauvegarde les critères d'un PDF.
     * POST /api/criteres/import-pdf?processusId=1
     */
    @PostMapping
    @PreAuthorize("hasAnyRole('ADMIN','ADMIN_PLANT','PPO')")
    @Operation(summary = "Importer les critères depuis un PDF checklist")
    public ResponseEntity<?> importPdf(
            @RequestParam("file") MultipartFile file,
            @RequestParam("processusId") Long processusId) {
        try {
            if (file.isEmpty()) {
                return ResponseEntity.badRequest().body(Map.of("error", "Fichier vide"));
            }
            if (!file.getOriginalFilename().toLowerCase().endsWith(".pdf")) {
                return ResponseEntity.badRequest().body(Map.of("error", "Fichier PDF requis"));
            }

            PdfImportService.ImportResult result = pdfImportService.importFromPdf(file, processusId);

            return ResponseEntity.ok(Map.of(
                    "success", true,
                    "processusNom", result.processusNom(),
                    "nbExtracted", result.nbExtracted(),
                    "nbImported", result.nbImported(),
                    "processusId", result.processusId(),
                    "warnings", result.warnings()));
        } catch (Exception e) {
            return ResponseEntity.internalServerError()
                    .body(Map.of("success", false, "error", e.getMessage()));
        }
    }
}