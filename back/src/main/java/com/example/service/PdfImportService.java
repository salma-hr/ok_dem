package com.example.service;

import com.example.dto.BatchCritereRequest;
import com.example.dto.CritereRequest;
import com.example.entity.Critere;
import com.example.entity.Processus;
import com.example.repository.ProcessusRepository;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.multipart.MultipartFile;

import java.util.ArrayList;
import java.util.List;

/**
 * Service d'import de critères depuis PDF via le microservice Python.
 * Flow : PDF → Python /extract-pdf → JSON → batch save en BDD
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class PdfImportService {

    private final CritereService critereService;
    private final ProcessusRepository processusRepository;
    private final RestTemplate restTemplate;
    private final ObjectMapper objectMapper;
    private final LibreTranslateService libreTranslateService;

    @Value("${pdf.extractor.url:http://localhost:8002/extract-pdf}")
    private String extractorUrl;

    @Value("${libretranslate.import.enabled:true}")
    private boolean translationEnabled;

    // ── Résultat retourné au contrôleur ──────────────────────────────────────

    public record ImportResult(
            String processusNom,
            int nbExtracted,
            int nbImported,
            Long processusId,
            List<String> warnings) {
    }

    // ── Preview uniquement (sans sauvegarde) ───────────────────────────────

    public JsonNode previewFromPdf(MultipartFile pdfFile) throws Exception {
        log.info("Preview PDF (sans sauvegarde) : {}", pdfFile.getOriginalFilename());
        return callPythonExtractor(pdfFile);
    }

    // ── Import principal ──────────────────────────────────────────────────────

    public ImportResult importFromPdf(MultipartFile pdfFile, Long processusId) throws Exception {

        // 1. Appeler le microservice Python
        log.info("Envoi PDF au service d'extraction : {}", pdfFile.getOriginalFilename());
        JsonNode extraction = callPythonExtractor(pdfFile);

        String processusNom = extraction.path("processusNom").asText("Inconnu");
        int nbExtracted = extraction.path("nbCriteres").asInt(0);
        List<String> warnings = new ArrayList<>();
        extraction.path("warnings").forEach(w -> warnings.add(w.asText()));

        if (nbExtracted == 0) {
            warnings.add("Aucun critère extrait du PDF.");
            return new ImportResult(processusNom, 0, 0, processusId, warnings);
        }

        // 2. Résoudre le processus cible
        Processus processus = processusRepository.findById(processusId)
                .orElseThrow(() -> new RuntimeException("Processus introuvable : " + processusId));

        // 3. Construire la BatchRequest
        // Vérifier disponibilité LibreTranslate une seule fois avant la boucle
        boolean canTranslate = translationEnabled && libreTranslateService.isAvailable();
        if (translationEnabled && !canTranslate) {
            warnings.add(
                    "LibreTranslate indisponible — traductions EN/DE ignorées. Vérifiez que Docker tourne sur http://localhost:5000");
            log.warn("LibreTranslate inaccessible : traductions EN/DE désactivées pour cet import");
        } else if (canTranslate) {
            log.info("LibreTranslate disponible : traduction automatique FR → EN + DE activée");
        }

        List<CritereRequest> critereRequests = new ArrayList<>();
        for (JsonNode c : extraction.path("criteres")) {
            CritereRequest req = new CritereRequest();

            String nomFr = c.path("nom").asText();
            String descFr = c.path("description").asText(null);

            req.setNom(nomFr);
            req.setDescription(descFr);
            req.setNomAr(c.path("nomAr").asText(null));
            req.setDescriptionAr(c.path("descriptionAr").asText(null));
            req.setCouleur(c.path("couleur").asText("Jaune"));
            req.setMoyenVerification(c.path("moyenVerification").asText("VISUEL"));
            req.setProcessusId(processusId);

           if (canTranslate) {
                req.setNomEn(libreTranslateService.toEnglish(nomFr));
                req.setNomDe(libreTranslateService.toGerman(nomFr));
                if (descFr != null && !descFr.isBlank()) {
                    req.setDescriptionEn(libreTranslateService.toEnglish(descFr));
                    req.setDescriptionDe(libreTranslateService.toGerman(descFr));
                }
            }
            if (canTranslate) {
                log.debug("Critère traduit : [FR] {} → [EN] {} / [DE] {}", nomFr, req.getNomEn(), req.getNomDe());
            }

            // Mapping type
            String typeStr = c.path("type").asText("QUALITE");
            try {
                req.setType(Critere.TypeCritere.valueOf(typeStr));
            } catch (IllegalArgumentException e) {
                req.setType(Critere.TypeCritere.QUALITE);
            }

            critereRequests.add(req);
        }

        BatchCritereRequest batch = new BatchCritereRequest();
        batch.setProcessusId(processusId);
        batch.setCriteres(critereRequests);

        // 4. Sauvegarder en batch
        String matricule = "IMPORT_PDF";
        critereService.ajouterBatch(batch, matricule);

        log.info("Import PDF terminé : {} critères sauvegardés pour processus #{} ({})",
                critereRequests.size(), processusId, processus.getNom());

        return new ImportResult(
                processusNom,
                nbExtracted,
                critereRequests.size(),
                processusId,
                warnings);
    }

    // ── Appel HTTP vers Python ────────────────────────────────────────────────

    private JsonNode callPythonExtractor(MultipartFile pdfFile) throws Exception {
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.MULTIPART_FORM_DATA);

        MultiValueMap<String, Object> body = new LinkedMultiValueMap<>();
        body.add("file", new ByteArrayResource(pdfFile.getBytes()) {
            @Override
            public String getFilename() {
                return pdfFile.getOriginalFilename();
            }
        });

        HttpEntity<MultiValueMap<String, Object>> request = new HttpEntity<>(body, headers);
        ResponseEntity<String> response = restTemplate.postForEntity(extractorUrl, request, String.class);

        if (!response.getStatusCode().is2xxSuccessful() || response.getBody() == null) {
            throw new RuntimeException("Service d'extraction indisponible (status: " + response.getStatusCode() + ")");
        }

        return objectMapper.readTree(response.getBody());
    }
}