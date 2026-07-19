package com.example.service;

import com.example.dto.BatchCritereRequest;
import com.example.dto.CritereDTO;
import com.example.dto.CritereRequest;
import com.example.entity.Critere;
import com.example.entity.Processus;
import com.example.repository.CritereRepository;
import com.example.repository.ProcessusRepository;
import com.example.repository.ReponseCritereRepository;
import lombok.RequiredArgsConstructor;
import org.hibernate.Hibernate;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

@Service
@RequiredArgsConstructor
@SuppressWarnings("null")
public class CritereService {

    private final CritereRepository critereRepository;
    private final ProcessusRepository processusRepository;
    private final ReponseCritereRepository reponseCritereRepository;
    private final CritereAuditService auditService;
    private final CritereImageStorageService imageStorageService;
    private final ImageGenerationCacheService imageGenerationCacheService;

    @Value("${hf.auto.enabled:true}")
    private boolean hfAutoEnabled;

    @Value("${hf.auto.fallback-wiki:true}")
    private boolean hfAutoFallbackWiki;

    // ─── Dictionnaire FR → EN pour les termes techniques ─────────────────────
   private static final Map<String, String> FR_TO_EN = new LinkedHashMap<>() {
    {
        // ── Machines spécifiques ─────────────────────────────────────────
        put("sonotrode", "sonotrode ultrasonic welding tip close-up industrial");
        put("plaquette", "ultrasonic welding anvil plaquette industrial close-up");
        put("positionneur", "wire positioning jig fixture industrial machine");
        put("mors", "crimping jaw die close-up industrial machine");
        put("lame", "cutting blade industrial machine close-up sharp");
        put("lames", "cutting blades industrial machine close-up");
        put("schunk", "SCHUNK ultrasonic welding machine industrial");
        put("telsonic", "TELSONIC ultrasonic welding machine industrial");
        put("cao", "barcode scanner CAO quality control industrial");
        put("scannage", "industrial barcode scanner reading label");
        put("scan", "barcode scanner industrial machine");
        put("convoyeur", "industrial conveyor belt production line");
        put("compresseur", "industrial air compressor machine");
        put("pneumatique", "pneumatic system air pressure gauge industrial");

        // ── Fils et câbles ───────────────────────────────────────────────
        put("fils", "electrical wire samples date label industrial quality control");
        put("fil ", "electrical wire cut sample industrial");
        put("échantillon", "wire sample date label expiry quality control industrial");
        put("validité", "wire sample expiry date label inspection industrial");
        put("découpage", "wire cutting machine industrial blades");
        put("câble", "electrical cable wiring harness industrial");
        put("câblage", "wiring harness assembly industrial");
        put("faisceau", "wiring harness connectors industrial assembly");
        put("connecteur", "electrical connector terminal industrial");
        put("sertissage", "wire crimping terminal industrial machine");
        put("sertir", "crimping machine wire terminal industrial");

        // ── Contrôle qualité ─────────────────────────────────────────────
        put("pression", "pressure gauge manometer industrial 7 bar");
        put("manomètre", "pressure gauge manometer close-up industrial");
        put("température", "temperature sensor digital display industrial");
        put("mesure", "measurement instrument caliper gauge industrial");
        put("pied à coulisse", "digital caliper measurement precision industrial");
        put("calibre", "gauge measuring instrument industrial precision");
        put("usure", "worn industrial tool wear inspection close-up");
        put("alignement", "machine alignment laser precision industrial");
        put("réglage", "machine adjustment settings industrial control panel");

        // ── Documents et traçabilité ─────────────────────────────────────
        put("document", "quality control form clipboard industrial workstation");
        put("fiche", "inspection checklist form industrial quality");
        put("enregistrement", "quality record document industrial binder");
        put("étiquette", "product label barcode sticker industrial");
        put("identification", "part identification label barcode industrial");
        put("traçabilité", "traceability barcode scanner industrial quality");
        put("affiche", "safety instruction poster wall industrial workplace");
        put("aide visuelle", "visual aid poster industrial workstation instruction");

        // ── Lubrification et nettoyage ───────────────────────────────────
        put("lubrifiant", "industrial lubricant oil machine maintenance");
        put("lubrification", "machine lubrication system oil industrial");
        put("nettoyage", "industrial cleaning workstation organized");
        put("propreté", "clean organized workstation 5S industrial");
        put("rangement", "organized tool storage shadow board 5S");
        put("déchets", "industrial waste sorting bins recycling");

        // ── Sécurité ─────────────────────────────────────────────────────
        put("arrêt urgence", "emergency stop button red mushroom industrial");
        put("urgence", "emergency stop button safety industrial machine");
        put("extincteur", "fire extinguisher wall mounted industrial");
        put("gants", "safety gloves PPE industrial protection");
        put("lunettes", "safety goggles eye protection industrial");
        put("casque", "hard hat safety helmet industrial PPE");
        put("sécurité", "industrial safety equipment PPE workplace");

        // ── Électricité ──────────────────────────────────────────────────
        put("tension", "electrical voltage multimeter measurement industrial");
        put("courant", "electrical current measurement industrial");
        put("moteur", "electric motor industrial machine");
        put("capteur", "industrial sensor probe detection");

        // ── Éclairage et environnement ───────────────────────────────────
        put("éclairage", "industrial workstation LED lighting bright");
        put("outillage", "precision tooling jig industrial organized");
        put("gabarit", "fixture jig workbench industrial precision");
    }
};

    // ─── Mots à supprimer du texte (verbes d'action, articles, stopwords) ────
    private static final Set<String> STOPWORDS = Set.of(
            "vérifier", "verifier", "contrôler", "controler", "inspecter",
            "s'assurer", "assurer", "valider", "confirmer", "veiller",
            "le", "la", "les", "un", "une", "des", "du", "de", "d",
            "au", "aux", "et", "ou", "en", "est", "sont", "par", "pour",
            "dans", "sur", "avec", "que", "qui", "se", "si", "il", "ce",
            "son", "sa", "ses", "leur", "leurs", "bon", "bonne", "bons",
            "fonctionnement", "fonctionnel", "activation", "existence",
            "présence", "absence", "état", "etat", "valeur", "entre",
            "selon", "lors", "avant", "après", "tout", "tous", "toute",
            "aussi", "même", "ainsi", "donc", "afin", "doit");

    private CritereDTO toDTO(Critere c) {
        CritereDTO dto = new CritereDTO();
        dto.setId(c.getId());
        dto.setNom(c.getNom());
        dto.setDescription(c.getDescription());
        dto.setNomAr(c.getNomAr());
        dto.setDescriptionAr(c.getDescriptionAr());
        dto.setNomEn(c.getNomEn());
        dto.setDescriptionEn(c.getDescriptionEn());
        dto.setNomDe(c.getNomDe());
        dto.setDescriptionDe(c.getDescriptionDe());
        dto.setType(c.getType());
        dto.setCouleur(c.getCouleur());
        dto.setMoyenVerification(c.getMoyenVerification());
        dto.setCategorie(c.getCategorie());
        dto.setImage(c.getImage());
        if (c.getProcessus() != null) {
            dto.setProcessusId(c.getProcessus().getId());
            if (Hibernate.isInitialized(c.getProcessus())) {
                dto.setProcessusNom(c.getProcessus().getNom());
            }
        }
        return dto;
    }

    private void applyRequest(Critere c, CritereRequest req) {
        if (req.getNom() != null)
            c.setNom(req.getNom().trim());
        if (req.getDescription() != null)
            c.setDescription(req.getDescription());
            c.setNomAr(req.getNomAr());
            c.setDescriptionAr(req.getDescriptionAr());

            // EN/DE : saisie manuelle uniquement (plus de traduction automatique)
            String nomEn  = resolveTranslation(req.getNomEn());
            String descEn = resolveTranslation(req.getDescriptionEn());

            String nomDe  = resolveTranslation(req.getNomDe());
            String descDe = resolveTranslation(req.getDescriptionDe());
        c.setNomEn(nomEn);
        c.setDescriptionEn(descEn);
        c.setNomDe(nomDe);
        c.setDescriptionDe(descDe);
        if (req.getType() != null)
            c.setType(req.getType());
        if (req.getCouleur() != null)
            c.setCouleur(req.getCouleur());
        if (req.getMoyenVerification() != null)
            c.setMoyenVerification(req.getMoyenVerification());
        if (req.getCategorie() != null)
            c.setCategorie(req.getCategorie());

        // Gestion de l'image
        if (req.getImage() != null) {
            String incoming = req.getImage().trim();
            if (incoming.isEmpty()) {
                imageStorageService.deleteIfLocal(c.getImage());
                c.setImage(null);
            } else if (imageStorageService.isDataUrl(incoming)) {
                imageStorageService.deleteIfLocal(c.getImage());
                c.setImage(imageStorageService.storeDataUrl(incoming));
            } else {
                if (!incoming.equals(c.getImage())) {
                    imageStorageService.deleteIfLocal(c.getImage());
                }
                c.setImage(incoming);
            }
        }

        // Si aucune image fournie, tenter la génération automatique (IA puis fallback)
        if ((req.getImage() == null || req.getImage().trim().isEmpty())
                && (c.getImage() == null || c.getImage().isEmpty())) {
            tryAutoAssignImage(c);
        }
    }

    private String resolveTranslation(String providedTranslation) {
        return providedTranslation != null && !providedTranslation.isBlank()
                ? providedTranslation.trim()
                : null;
    }

    public boolean assignAutoImageIfMissing(Critere c) {
        if (c == null) {
            return false;
        }
        if (c.getImage() != null && !c.getImage().isBlank()) {
            return false;
        }
        tryAutoAssignImage(c);
        return c.getImage() != null && !c.getImage().isBlank();
    }

    private void tryAutoAssignImage(Critere c) {
        if (c.getImage() != null && !c.getImage().isBlank()) {
            return;
        }

        boolean aiOk = false;
        if (hfAutoEnabled) {
            try {
                String imageUrl = imageGenerationCacheService.getOrGenerate(buildPrompt(c), "ai-auto-");
                c.setImage(imageUrl);
                aiOk = true;
            } catch (Exception ignored) {
                // Fallback silencieux vers Wikipedia
            }
        }

    }

    @Transactional
    public List<CritereDTO> findAll() {
        List<Critere> criteres = critereRepository.findAllWithProcessus();
        backfillMissingGermanTranslations(criteres);
        return criteres.stream().map(this::toDTO).toList();
    }

    @Transactional
    public List<CritereDTO> findByProcessus(Long processusId) {
        return findByProcessus(processusId, null);
    }

    @Transactional
    public List<CritereDTO> findByProcessus(Long processusId, String ussVariant) {
        List<Critere> criteres = critereRepository.findByProcessusId(processusId);
        
        // Filtrer par variante USS si fournie
        if (ussVariant != null && !ussVariant.isEmpty()) {
            criteres = criteres.stream()
                .filter(c -> 
                    c.getUssVariant() == null ||  // null = applicable aux deux variantes
                    c.getUssVariant().equals(ussVariant)  // ou correspondance exacte
                )
                .toList();
        }
        
        backfillMissingGermanTranslations(criteres);
        return criteres.stream().map(this::toDTO).toList();
    }

    private void backfillMissingGermanTranslations(List<Critere> criteres) {
       
    }

    @Transactional
    public CritereDTO create(CritereRequest req, String matricule) {
        Processus p = processusRepository.findById(req.getProcessusId())
                .orElseThrow(() -> new RuntimeException("Processus introuvable"));
        Critere c = new Critere();
        applyRequest(c, req);
        c.setProcessus(p);
        Critere saved = critereRepository.save(c);
        auditService.logCreation(saved, matricule);
        return toDTO(saved);
    }

    @Transactional
    public CritereDTO update(Long id, CritereRequest req, String matricule) {
        Critere c = critereRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Critère introuvable"));
        Critere avant = snapshotCritere(c);
        applyRequest(c, req);
        if (req.getProcessusId() != null) {
            Processus p = processusRepository.findById(req.getProcessusId())
                    .orElseThrow(() -> new RuntimeException("Processus introuvable"));
            c.setProcessus(p);
        }
        Critere saved = critereRepository.save(c);
        auditService.logModification(avant, saved, matricule);
        return toDTO(saved);
    }

    @Transactional
    public String delete(Long id, String matricule) {
        Critere c = critereRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Critère introuvable"));

        if (isUsedByChecklistResponses(c.getId())) {
            archiveCritere(c, matricule);
            return "Critère archivé : déjà utilisé dans des checklists.";
        }

        hardDeleteCritere(c, matricule);
        return "Critère supprimé.";
    }

    @Transactional
    public String deleteAll(List<Long> ids, String matricule) {
        if (ids == null || ids.isEmpty()) {
            return "Aucun critère sélectionné.";
        }

        List<Critere> criteres = critereRepository.findAllById(ids);
        int deleted = 0;
        int archived = 0;

        for (Critere critere : criteres) {
            if (isUsedByChecklistResponses(critere.getId())) {
                archiveCritere(critere, matricule);
                archived++;
            } else {
                hardDeleteCritere(critere, matricule);
                deleted++;
            }
        }

        return deleted + " critère(s) supprimé(s), " + archived + " critère(s) archivé(s).";
    }

    private boolean isUsedByChecklistResponses(Long critereId) {
        Long count = reponseCritereRepository.countByCritereId(critereId);
        return count != null && count > 0;
    }

    private void archiveCritere(Critere critere, String matricule) {
        Critere before = snapshotCritere(critere);
        critere.setActif(false);
        critere.setProcessus(null);
        Critere saved = critereRepository.save(critere);
        auditService.logModification(before, saved, matricule);
    }

    private void hardDeleteCritere(Critere critere, String matricule) {
        auditService.logSuppression(critere, matricule);
        critereRepository.delete(critere);
        critereRepository.flush();
        imageStorageService.deleteIfLocal(critere.getImage());
    }

    @Transactional
    public String ajouterBatch(BatchCritereRequest req, String matricule) {
        Processus processus = processusRepository.findById(req.getProcessusId())
                .orElseThrow(() -> new RuntimeException("Processus introuvable"));
        List<CritereRequest> lignes = req.getCriteres();
        if (lignes == null || lignes.isEmpty())
            throw new RuntimeException("Aucun critère fourni.");
        int count = 0;
        for (CritereRequest cr : lignes) {
            if (cr.getNom() == null || cr.getNom().trim().length() < 2)
                continue;
            Critere critere = new Critere();
            applyRequest(critere, cr);
            critere.setProcessus(processus);
            Critere saved = critereRepository.save(critere);
            auditService.logCreation(saved, matricule);
            count++;
        }
        if (count == 0)
            throw new RuntimeException("Aucun critère valide.");
        return count + " critère(s) ajouté(s) avec succès.";
    }

    private Critere snapshotCritere(Critere src) {
        Critere snap = new Critere();
        snap.setId(src.getId());
        snap.setNom(src.getNom());
        snap.setDescription(src.getDescription());
        snap.setNomAr(src.getNomAr());
        snap.setDescriptionAr(src.getDescriptionAr());
        snap.setType(src.getType());
        snap.setCouleur(src.getCouleur());
        snap.setMoyenVerification(src.getMoyenVerification());
        snap.setCategorie(src.getCategorie());
        snap.setActif(src.isActif());
        snap.setProcessus(src.getProcessus());
        return snap;
    }

    @org.springframework.transaction.annotation.Transactional
    public java.util.Map<String, Object> recomputeImages(Long processusId, boolean force, int limit, String matricule) {
        java.util.List<com.example.entity.Critere> criteres = (processusId != null)
                ? critereRepository.findByProcessusId(processusId)
                : critereRepository.findAllWithProcessus();
        int count = 0;
        for (com.example.entity.Critere c : criteres) {
            boolean hasImage = c.getImage() != null && !c.getImage().isBlank();
            boolean localMissing = hasImage
                    && c.getImage().startsWith("/uploads/")
                    && !imageStorageService.existsLocal(c.getImage());
            if (!force && hasImage && !localMissing)
                continue;

            String previousImage = c.getImage();
            boolean updated = false;

            if (hfAutoEnabled) {
                try {
                    String aiUrl = imageGenerationCacheService.getOrGenerate(buildPrompt(c), "ai-recompute-");
                    c.setImage(aiUrl);
                    updated = true;
                } catch (Exception ignored) {
                    // fallback wiki juste après
                }
            }

            if (updated) {
                if (previousImage != null && !previousImage.equals(c.getImage())) {
                    imageStorageService.deleteIfLocal(previousImage);
                }
                critereRepository.save(c);
                count++;
            }

            if (limit > 0 && count >= limit)
                break;
        }
        return java.util.Map.of("updated", count);
    }

    @org.springframework.transaction.annotation.Transactional
    public String generateAiImage(Long id, String prompt) {
        com.example.entity.Critere c = critereRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Critere not found"));

        String finalPrompt = (prompt == null || prompt.isBlank())
                ? buildPrompt(c)
                : prompt.trim();

        try {
            String imageUrl = imageGenerationCacheService.getOrGenerate(finalPrompt, "ai-");
            c.setImage(imageUrl);
            critereRepository.save(c);
            return imageUrl;
        } catch (RuntimeException aiError) {
            // Si HF est indisponible (ex: credits epuises), fallback sur Wikipedia pour
            // eviter un 400 systematique lors des imports volumineux.

            if (isHfCreditsDepleted(aiError)) {
                throw new RuntimeException(
                        "Generation IA indisponible (credits Hugging Face epuises) et aucune image Wikipedia pertinente trouvee.");
            }

            throw aiError;
        }
    }

    private boolean isHfCreditsDepleted(Throwable error) {
        String message = error != null ? error.getMessage() : null;
        if (message == null || message.isBlank()) {
            return false;
        }
        String lower = message.toLowerCase();
        return lower.contains("payment_required")
                || lower.contains("402")
                || lower.contains("depleted")
                || lower.contains("credits");
    }

    /**
     * Construit un prompt en ANGLAIS uniquement, précis et concis,
     * à partir du nom/description du critère en français.
     *
     * Stratégie :
     * 1. Traduire les termes techniques FR → EN via le dictionnaire
     * 2. Extraire les mots-clés significatifs (supprimer stopwords/verbes)
     * 3. Ajouter un contexte industriel fixe + qualité photo
     */
    private String buildPrompt(com.example.entity.Critere c) {
    String text = (c.getNom() != null && !c.getNom().isBlank())
            ? c.getNom()
            : (c.getDescription() != null ? c.getDescription() : "");

    String lower = text.toLowerCase();

    // ── 1. Chercher TOUTES les correspondances dans le dictionnaire ──────
    StringBuilder dictMatches = new StringBuilder();
    for (Map.Entry<String, String> entry : FR_TO_EN.entrySet()) {
        if (lower.contains(entry.getKey())) {
            if (dictMatches.length() > 0) dictMatches.append(", ");
            dictMatches.append(entry.getValue());
            if (dictMatches.toString().split(",").length >= 3) break;
        }
    }
    if (dictMatches.length() > 0) {
        return buildFinalPrompt(dictMatches.toString(), c.getCategorie());
    }

    // ── 2. Extraire les mots-clés significatifs ──────────────────────────
    String[] words = lower
            .replaceAll("[^a-zàâäéèêëîïôöùûüçœ0-9\\s]", " ")
            .split("\\s+");

    StringBuilder keywords = new StringBuilder();
    for (String word : words) {
        String clean = word.replaceAll("^['-]+|['-]+$", "");
        if (clean.length() >= 4 && !STOPWORDS.contains(clean)) {
            if (keywords.length() > 0) keywords.append(" ");
            keywords.append(clean);
        }
        if (keywords.toString().trim().split("\\s+").length >= 5) break;
    }

    String subject = keywords.length() > 0
            ? keywords.toString()
            : categoryFallback(c.getCategorie());

    return buildFinalPrompt(subject, c.getCategorie());
}
    /**
     * Assemble le prompt final avec le contexte industriel et les directives
     * qualité.
     * Format optimisé pour FLUX.1-schnell et SD3.
     */
    private String buildFinalPrompt(String subject, String categorie) {
        String qualityTags = "photorealistic, sharp focus, 4K, professional industrial photography, " +
                "studio lighting, no text, no watermark, no people";

        String context = switch (categorie != null ? categorie.toLowerCase() : "") {
            case "qualité", "qualite" -> "quality control inspection station, ";
            case "sécurité", "securite" -> "industrial safety workplace, ";
            case "technique" -> "industrial machine close-up, ";
            default -> "wire harness manufacturing factory, ";
        };

        return context + subject + ", " + qualityTags;
    }

    /** Fallback générique si aucun mot-clé trouvé, basé sur la catégorie. */
    private String categoryFallback(String categorie) {
        if (categorie == null)
            return "industrial equipment";
        return switch (categorie.toLowerCase()) {
            case "qualité", "qualite" -> "quality control measuring instruments caliper gauge";
            case "sécurité", "securite" -> "safety equipment PPE gloves goggles helmet";
            case "technique" -> "industrial machine control panel gauges";
            default -> "wire harness assembly workstation";
        };
    }
}